import { type Actor } from "$lib/crossover/types";
import {
    calculatePathDuration,
    geohashesNearby,
    getEntityId,
    minifiedEntity,
} from "$lib/crossover/utils";
import { entityStats } from "$lib/crossover/world/entity";
import { actions } from "$lib/crossover/world/settings/actions";
import {
    type Direction,
    type GeohashLocation,
} from "$lib/crossover/world/types";
import {
    type CreatureEntity,
    type ItemEntity,
    type PlayerEntity,
} from "$lib/server/crossover/types";
import { cloneDeep } from "lodash-es";
import { setEntityBusy } from "..";
import type { FeedEventVariables } from "../../../../routes/api/crossover/stream/+server";
import { spawnLocation } from "../dm";
import { publishAffectedEntitiesToPlayers, publishFeedEvent } from "../events";
import {
    verifyP2PTransaction,
    type P2PLearnTransaction,
    type P2PTradeTransaction,
} from "../player";
import {
    getNearbyEntities,
    getNearbyPlayerIds,
    inventoryQuerySet,
    playersInGeohashQuerySet,
} from "../redis/queries";
import { fetchEntity, saveEntity } from "../redis/utils";
import { isDirectionTraversable } from "../utils";
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
            // Say to human player (in range)
            if (
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
            player.locT as GeohashLocation,
            player.locI,
        ).return.allIds({ pageSize: LOOK_PAGE_SIZE }); // limit players using page size
    }

    // Send message to all players in the geohash (non blocking)
    for (const publicKey of players) {
        const variables: FeedEventVariables = {
            cmd: "say",
            player: player.player, // the player saying
            name: player.name,
            message: message,
        };

        if (options?.target) {
            variables.target = options.target;
        }

        await publishFeedEvent(publicKey, {
            type: "message",
            message: options?.overwrite
                ? "${message}"
                : "${name} says ${message}",
            variables,
        });
    }
}

async function move(entity: CreatureEntity, path: Direction[], now?: number) {
    // Get path duration
    now = now ?? Date.now();
    const duration = calculatePathDuration(path);
    const [entityId, entityType] = getEntityId(entity);

    // Set busy
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
            entity.locT as GeohashLocation,
            entity.locI,
            direction,
        );
        if (!isTraversable) {
            const error = `Path is not traversable`;
            if (entityType === "player") {
                await publishFeedEvent(entityId, {
                    type: "error",
                    message: error,
                });
            }
            return; // do not proceed
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

    // Request nearby entities if p6Changed
    if (p6Changed && entityType === "player") {
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

async function look(
    player: PlayerEntity,
    options?: { inventory?: boolean },
): Promise<Actor[]> {
    const { monsters, players, items } = await getNearbyEntities(
        player.loc[0],
        player.locT as GeohashLocation,
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
        ...monsters.map((e) => minifiedEntity(e, { stats: true })),
        ...players.map((e) =>
            minifiedEntity(e, {
                demographics: true,
                stats: true,
            }),
        ),
        ...items.map((e) => minifiedEntity(e, { stats: true })),
        ...inventoryItems,
    ];

    await publishAffectedEntitiesToPlayers(entities, {
        publishTo: [player.player],
        op: "replace",
    });

    return entities;
}

async function inventory(player: PlayerEntity) {
    const inventoryItems = (await inventoryQuerySet(
        player.player,
    ).return.all()) as ItemEntity[];

    await publishAffectedEntitiesToPlayers(inventoryItems, {
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
    const { hp, cha, mnd } = entityStats(player);
    player.hp = hp;
    player.cha = cha;
    player.mnd = mnd;

    // Save player
    player = await saveEntity(player);

    // Publish update event
    await publishAffectedEntitiesToPlayers([player], {
        publishTo: [player.player],
    });
}

async function fulfill(player: PlayerEntity, writ: string) {
    const writEntity = (await fetchEntity(writ)) as ItemEntity;

    if (!writEntity) {
        await publishFeedEvent(player.player, {
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
