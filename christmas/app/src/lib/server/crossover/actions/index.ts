import { type Actor } from "$lib/crossover/types";
import { geohashesNearby, minifiedEntity } from "$lib/crossover/utils";
import { entityStats } from "$lib/crossover/world/entity";
import { actions } from "$lib/crossover/world/settings/actions";
import { type GeohashLocation } from "$lib/crossover/world/types";
import {
    type ItemEntity,
    type PlayerEntity,
} from "$lib/server/crossover/types";
import { setEntityBusy } from "..";
import type { FeedEventVariables } from "../../../../routes/api/crossover/stream/+server";
import { publishAffectedEntitiesToPlayers, publishFeedEvent } from "../events";
import {
    verifyP2PTransaction,
    type P2PLearnTransaction,
    type P2PTradeTransaction,
} from "../player";
import {
    getNearbyEntities,
    inventoryQuerySet,
    playersInGeohashQuerySet,
} from "../redis/queries";
import { fetchEntity, saveEntity } from "../redis/utils";
import { executeLearnCTA } from "./learn";
import { executeTradeCTA } from "./trade";

export { fulfill, inventory, look, LOOK_PAGE_SIZE, rest, say, setEntityBusy };

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
