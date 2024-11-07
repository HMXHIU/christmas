import { aStarPathfinding } from "$lib/crossover/pathfinding";
import {
    calculatePathDuration,
    entityInRange,
    geohashToColRow,
    getEntityId,
    gridCellToGeohash,
    minifiedEntity,
    sameLocation,
} from "$lib/crossover/utils";
import { carryingCapacity } from "$lib/crossover/world/entity";
import { MS_PER_TICK } from "$lib/crossover/world/settings";
import { actions } from "$lib/crossover/world/settings/actions";
import { worldSeed } from "$lib/crossover/world/settings/world";
import {
    type Direction,
    type GeohashLocation,
} from "$lib/crossover/world/types";
import {
    type ActorEntity,
    type CreatureEntity,
    type PlayerEntity,
} from "$lib/server/crossover/types";
import { sleep } from "$lib/utils";
import { cloneDeep } from "lodash-es";
import { LOOK_PAGE_SIZE } from ".";
import { setEntityBusy } from "..";
import { spawnLocation } from "../dm";
import { publishAffectedEntitiesToPlayers, publishFeedEvent } from "../events";
import { getNearbyEntities, getNearbyPlayerIds } from "../redis/queries";
import { saveEntity } from "../redis/utils";
import { isDirectionTraversable, isGeohashTraversableServer } from "../utils";

export { getPathToTarget, move, moveInRangeOfTarget };

async function move(entity: CreatureEntity, path: Direction[], now?: number) {
    // Get path duration
    now = now ?? Date.now();
    const duration = calculatePathDuration(path);
    const [entityId, entityType] = getEntityId(entity);

    // Set busy
    await setEntityBusy({
        entity: entity,
        action: actions.move.action,
        duration, // use the duration of the full path
        now,
    });

    // Check overweight (only PlayerEntity)
    if (
        entityType === "player" &&
        (entity as PlayerEntity).wgt > carryingCapacity(entity)
    ) {
        await publishFeedEvent(entityId, {
            type: "error",
            message: `You are overweight.`,
        });
        return; // do not proceed if overweight
    }

    // Check if the full path is traversable
    let loc = cloneDeep(entity.loc);
    for (const direction of path) {
        const [isTraversable, location] = await isDirectionTraversable(
            loc,
            entity.locT as GeohashLocation,
            entity.locI,
            direction,
        );
        if (!isTraversable) {
            if (entityType === "player") {
                await publishFeedEvent(entityId, {
                    type: "error",
                    message: `Path is not traversable.`,
                });
            }
            return; // do not proceed if path is obstructed
        } else {
            loc = location; // final location of the path
        }
    }

    // Update location and path
    entity.pth = path;
    entity.pthst = entity.loc[0]; // origin is always the first loc
    entity.pthdur = duration;
    entity.pthclk = now;
    entity.loc = loc; // update loc immediately to final location (client and server to use `pthclk` to determine exact location)
    entity = await saveEntity(entity);

    // Inform all players nearby of location change
    const nearbyPlayerIds = await getNearbyPlayerIds(
        entity.loc[0],
        entity.locT as GeohashLocation,
        entity.locI,
    );
    await publishAffectedEntitiesToPlayers(
        [minifiedEntity(entity, { demographics: true })],
        {
            publishTo: nearbyPlayerIds,
        },
    );

    // Check if entity moved to a new village
    const movedToNewVillage =
        entity.loc[0].slice(0, worldSeed.spatial.village.precision) !==
        loc[0].slice(0, worldSeed.spatial.village.precision);

    // Request nearby entities if movedToNewVillage
    if (movedToNewVillage && entityType === "player") {
        const { players, monsters, items } = await getNearbyEntities(
            entity.loc[0],
            entity.locT as GeohashLocation,
            entity.locI,
            LOOK_PAGE_SIZE,
        );
        await publishAffectedEntitiesToPlayers(
            [
                ...monsters.map((e) => minifiedEntity(e)),
                ...players
                    .filter((p) => p.player !== entityId)
                    .map((e) => minifiedEntity(e, { demographics: true })), // exclude self (already received above)
                ...items.map((e) => minifiedEntity(e)),
            ],
            { publishTo: [entityId] },
        );

        // Spawn location (Do not block, spawn in the background)
        spawnLocation(
            entity.loc[0],
            entity.locT as GeohashLocation,
            entity.locI,
        );
    }
}

async function moveInRangeOfTarget(
    entity: CreatureEntity,
    target: ActorEntity,
    range: number,
) {
    if (entity && target) {
        const [reachable, path] = await getPathToTarget({
            entity,
            target,
            range,
        });
        if (reachable && path.length > 0) {
            await move(entity, path);
            await sleep(actions.move.ticks * MS_PER_TICK);
        }
    }
}

async function getPathToTarget({
    entity,
    target,
    range,
}: {
    entity: ActorEntity;
    target: ActorEntity;
    range: number;
}): Promise<[boolean, Direction[]]> {
    // No path to target
    if (!sameLocation(entity, target)) {
        return [false, []];
    }

    // Check already in range
    if (entityInRange(entity, target, range)[0]) {
        return [true, []];
    }

    // Move in range of target
    const targetGeohash = target.loc[0]; // TODO: consider entities with loc more than 1 cell
    const sourceGeohash = entity.loc[0];
    const [targetCol, targetRow] = geohashToColRow(targetGeohash);
    const [sourceCol, sourceRow] = geohashToColRow(sourceGeohash);
    return [
        true,
        await getDirectionsToPosition(
            {
                row: sourceRow,
                col: sourceCol,
            },
            {
                row: targetRow,
                col: targetCol,
            },
            target.locT as GeohashLocation,
            target.locI,
            { range },
        ),
    ];
}

async function getTraversalCostServer(
    row: number,
    col: number,
    locationType: GeohashLocation,
    locationInstance: string,
    precision?: number,
): Promise<number> {
    // 0 is walkable, 1 is not
    return (await isGeohashTraversableServer(
        gridCellToGeohash({
            col,
            row,
            precision: precision ?? worldSeed.spatial.unit.precision,
        }),
        locationType,
        locationInstance,
    ))
        ? 0
        : 1;
}

async function getDirectionsToPosition(
    source: { row: number; col: number },
    target: { row: number; col: number },
    locationType: GeohashLocation,
    locationInstance: string,
    options?: {
        range?: number;
        precision?: number;
    },
): Promise<Direction[]> {
    return await aStarPathfinding({
        colStart: source.col,
        rowStart: source.row,
        colEnd: target.col,
        rowEnd: target.row,
        range: options?.range,
        getTraversalCost: (row, col) =>
            getTraversalCostServer(
                row,
                col,
                locationType,
                locationInstance,
                options?.precision,
            ),
    });
}
