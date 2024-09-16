import {
    calculatePathDuration,
    geohashesNearby,
    getEntityId,
    minifiedEntity,
} from "$lib/crossover/utils";
import { actions } from "$lib/crossover/world/actions";
import { entityStats } from "$lib/crossover/world/entity";
import {
    type Direction,
    type GeohashLocationType,
} from "$lib/crossover/world/types";
import { cloneDeep } from "lodash-es";
import { setEntityBusy } from "..";
import { npcRespondToAction } from "../npc";
import {
    verifyP2PTransaction,
    type P2PLearnTransaction,
    type P2PTradeTransaction,
} from "../player";
import {
    fetchEntity,
    getNearbyEntities,
    getNearbyPlayerIds,
    inventoryQuerySet,
    playerRepository,
    playersInGeohashQuerySet,
    saveEntity,
} from "../redis";
import {
    type GameEntity,
    type ItemEntity,
    type MonsterEntity,
    type PlayerEntity,
} from "../redis/entities";
import {
    isDirectionTraversable,
    publishAffectedEntitiesToPlayers,
    publishFeedEvent,
} from "../utils";
import { executeLearnCTA } from "./learn";
import { executeTradeCTA } from "./trade";

export {
    fulfill,
    inventory,
    look,
    LOOK_PAGE_SIZE,
    move,
    rest,
    say,
    setEntityBusy,
};

const LOOK_PAGE_SIZE = 20;

async function say(
    player: PlayerEntity,
    message: string,
    options?: {
        target?: string;
        now?: number;
        overwrite?: boolean;
    },
) {
    // Set busy
    player = (await setEntityBusy({
        entity: player,
        action: actions.say.action,
        now: options?.now,
    })) as PlayerEntity;

    // Say to specific player
    let players: string[] = [];
    if (options?.target) {
        const targetEntity = await fetchEntity(options.target);
        if (targetEntity && "player" in targetEntity) {
            // Say to npc
            if (targetEntity.npc) {
                npcRespondToAction({
                    entity: player,
                    target: targetEntity as PlayerEntity,
                    action: "say",
                });
            }
            // Say to human player (in range)
            else if (
                player.locI === targetEntity.locI &&
                player.locT === targetEntity.locT &&
                geohashesNearby(player.loc[0].slice(0, -1), true).find((g) =>
                    targetEntity.loc[0].startsWith(g),
                )
            ) {
                players = [options.target];
            }
        }
    }
    // Say to nearby player
    else {
        // Get logged in players in geohash
        players = await playersInGeohashQuerySet(
            geohashesNearby(player.loc[0].slice(0, -1), true), // use p7 square for `say` radius
            player.locT as GeohashLocationType,
            player.locI,
        ).return.allIds({ pageSize: LOOK_PAGE_SIZE }); // limit players using page size
    }

    // Send message to all players in the geohash (non blocking)
    for (const publicKey of players) {
        publishFeedEvent(publicKey, {
            type: "message",
            message: options?.overwrite
                ? "${message}"
                : "${name} says ${message}",
            variables: {
                cmd: "say",
                player: player.player,
                name: player.name,
                message: message,
            },
        });
    }
}

async function move(
    entity: PlayerEntity | MonsterEntity,
    path: Direction[],
    now?: number,
): Promise<PlayerEntity | MonsterEntity> {
    // Get path duration
    now = now ?? Date.now();
    const duration = calculatePathDuration(path);
    const [entityId, entityType] = getEntityId(entity);

    // Check if entity is busy
    entity = await setEntityBusy({
        entity: entity,
        action: actions.move.action,
        duration, // use the duration of the full path
        now,
    });

    // Check if the full path is traversable
    let loc = cloneDeep(entity.loc);
    for (const direction of path) {
        const [isTraversable, location] = await isDirectionTraversable(
            loc,
            entity.locT as GeohashLocationType,
            entity.locI,
            direction,
        );
        if (!isTraversable) {
            const error = `Path is not traversable`;
            if (entityType === "player") {
                publishFeedEvent(entityId, {
                    type: "error",
                    message: error,
                });
            }
            throw new Error(error);
        } else {
            loc = location;
        }
    }

    // Check if entity moves to a new p6
    const p6Changed = entity.loc[0].slice(0, -2) !== loc[0].slice(0, -2);

    // Update location and path
    entity.pth = path;
    entity.pthst = entity.loc[0]; // origin is always the first loc
    entity.pthdur = duration;
    entity.pthclk = now;
    entity.loc = loc; // update loc immediately to final location (client and server to use `pthclk` to determine exact location)
    entity = (await saveEntity(entity)) as PlayerEntity | MonsterEntity;

    // Inform all players nearby of location change
    const nearbyPlayerIds = await getNearbyPlayerIds(
        entity.loc[0],
        entity.locT as GeohashLocationType,
        entity.locI,
    );
    publishAffectedEntitiesToPlayers(
        [minifiedEntity(entity, { location: true, demographics: true })],
        {
            publishTo: nearbyPlayerIds,
        },
    );

    // Request nearby entities if p6Changed
    if (p6Changed && entityType === "player") {
        const { players, monsters, items } = await getNearbyEntities(
            entity.loc[0],
            entity.locT as GeohashLocationType,
            entity.locI,
            LOOK_PAGE_SIZE,
        );
        publishAffectedEntitiesToPlayers(
            [
                ...monsters.map((e) => minifiedEntity(e, { location: true })),
                ...players
                    .filter((p) => p.player !== entityId)
                    .map((e) =>
                        minifiedEntity(e, {
                            location: true,
                            demographics: true,
                        }),
                    ), // exclude self (already received above)
                ...items.map((e) => minifiedEntity(e, { location: true })),
            ],
            { publishTo: [entityId] },
        );
    }

    return entity;
}

async function look(
    player: PlayerEntity,
    options?: { inventory?: boolean },
): Promise<GameEntity[]> {
    const { monsters, players, items } = await getNearbyEntities(
        player.loc[0],
        player.locT as GeohashLocationType,
        player.locI,
        LOOK_PAGE_SIZE,
    );

    const inventoryItems = options?.inventory
        ? ((await inventoryQuerySet(
              player.player,
          ).return.all()) as ItemEntity[])
        : [];

    const entities = [
        player,
        ...monsters.map((e) => minifiedEntity(e, { location: true })),
        ...players.map((e) =>
            minifiedEntity(e, { location: true, demographics: true }),
        ),
        ...items.map((e) => minifiedEntity(e, { location: true })),
        ...inventoryItems,
    ];

    publishAffectedEntitiesToPlayers(entities, {
        publishTo: [player.player],
        op: "replace",
    });

    return entities;
}

async function inventory(player: PlayerEntity) {
    const inventoryItems = (await inventoryQuerySet(
        player.player,
    ).return.all()) as ItemEntity[];

    publishAffectedEntitiesToPlayers(inventoryItems, {
        publishTo: [player.player],
    });
}

async function rest(player: PlayerEntity, now?: number) {
    // Set busy
    player = (await setEntityBusy({
        entity: player,
        action: actions.rest.action,
        now: now,
    })) as PlayerEntity;

    // Rest player
    const { hp, mp, st } = entityStats(player);
    player.hp = hp;
    player.mp = mp;
    player.st = st;

    // Save player
    player = (await playerRepository.save(
        player.player,
        player,
    )) as PlayerEntity;

    // Publish update event
    publishAffectedEntitiesToPlayers([player], {
        publishTo: [player.player],
    });
}

async function fulfill(player: PlayerEntity, writ: string) {
    const writEntity = (await fetchEntity(writ)) as ItemEntity;

    if (!writEntity) {
        publishFeedEvent(player.player, {
            type: "error",
            message: "The writ no longer exists or has already been fulfilled.",
        });
        return;
    }

    const { token } = writEntity.vars;
    const p2pTx = await verifyP2PTransaction(token as string);
    if (p2pTx.transaction === "trade") {
        await executeTradeCTA(player, p2pTx as P2PTradeTransaction, writEntity);
    } else if (p2pTx.transaction === "learn") {
        await executeLearnCTA(player, p2pTx as P2PLearnTransaction, writEntity);
    }
}
