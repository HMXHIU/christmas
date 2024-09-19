import type { Item, Monster, Player } from "$lib/crossover/types";
import { uniq, uniqBy } from "lodash-es";
import type {
    ActionEvent,
    CTAEvent,
    FeedEvent,
    UpdateEntitiesEvent,
} from "../../../routes/api/crossover/stream/+server";
import { isPublicKeyNPC, npcRespondToEvent } from "./npc";
import { redisClient } from "./redis";

export {
    publishActionEvent,
    publishAffectedEntitiesToPlayers,
    publishCTAEvent,
    publishFeedEvent,
};

async function publishFeedEvent(
    player: string,
    event: Omit<FeedEvent, "event">,
) {
    (event as FeedEvent).event = "feed";
    // Send to NPC
    if (await isPublicKeyNPC(player)) {
        await npcRespondToEvent(event as FeedEvent, player);
    }
    // Send to human player
    else {
        await redisClient.publish(player, JSON.stringify(event));
    }
}

async function publishCTAEvent(player: string, event: Omit<CTAEvent, "event">) {
    (event as CTAEvent).event = "cta";
    await redisClient.publish(player, JSON.stringify(event));
}

async function publishActionEvent(
    players: string[],
    event: Omit<ActionEvent, "event">,
) {
    (event as ActionEvent).event = "action";
    const message = JSON.stringify(event);
    for (const p of players) {
        await redisClient.publish(p, message);
    }
}

async function publishAffectedEntitiesToPlayers(
    entities: (Player | Monster | Item)[],
    options?: {
        publishTo?: string[];
        op?: "replace" | "upsert";
    },
) {
    const op = options?.op || "upsert";

    const effectedPlayers = uniqBy(
        entities.filter((entity) => (entity as Player).player),
        "player",
    );
    const effectedMonsters = uniqBy(
        entities.filter((entity) => (entity as Monster).monster),
        "monster",
    );
    const effectedItems = uniqBy(
        entities.filter((entity) => (entity as Item).item),
        "item",
    );

    const event = JSON.stringify({
        event: "entities",
        players: effectedPlayers,
        monsters: effectedMonsters,
        items: effectedItems,
        op,
    } as UpdateEntitiesEvent);

    if (options?.publishTo != null) {
        for (const p of uniq(options.publishTo)) {
            await redisClient.publish(p, event);
        }
    } else {
        // Publish effects to all players
        for (const p of effectedPlayers) {
            await redisClient.publish((p as Player).player, event);
        }
    }
}
