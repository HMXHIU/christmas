import { minifiedEntity } from "$lib/crossover/utils";
import { isItemFood, isItemInInventory } from "$lib/crossover/world/compendium";
import { entityStats } from "$lib/crossover/world/entity";
import { actions } from "$lib/crossover/world/settings/actions";
import type { GeohashLocation } from "$lib/crossover/world/types";
import {
    type ItemEntity,
    type PlayerEntity,
} from "$lib/server/crossover/types";
import { savePlayerState } from "$lib/server/user";
import { setEntityBusy } from "..";
import { pushCondition } from "../combat/condition";
import {
    publishActionEvent,
    publishAffectedEntitiesToPlayers,
    publishFeedEvent,
} from "../events";
import { itemRepository } from "../redis";
import { getNearbyPlayerIds } from "../redis/queries";
import { saveEntity } from "../redis/utils";

export { rest };

async function rest(player: PlayerEntity, food: ItemEntity, now?: number) {
    // Check if can eat
    const [ok, error] = canEatItem(player, food);
    if (!ok) {
        publishFeedEvent(player.player, {
            type: "error",
            message: error,
        });
        return; // do not proceed
    }

    // Set busy
    player = (await setEntityBusy({
        entity: player,
        action: actions.rest.action,
        now,
    })) as PlayerEntity;

    // Add sleep condition
    player.cond = pushCondition(player.cond, "sleep", player, now);

    // Destroy food
    food.delete = true;
    await itemRepository.remove(food.item);

    // Get nearby players
    const nearbyPlayerIds = await getNearbyPlayerIds(
        player.loc[0],
        player.locT as GeohashLocation,
        player.locI,
    );

    // Rest player
    const { hp, cha, mnd } = entityStats(player);
    player.hp += hp / 2;
    player.cha = cha;
    player.mnd = mnd;

    // Save player
    await saveEntity(player);
    await savePlayerState(player.player);

    // Publish action event
    await publishActionEvent(nearbyPlayerIds, {
        action: "rest",
        source: player.player,
        target: food.item,
    });

    // Publish entities event
    await publishAffectedEntitiesToPlayers(
        [
            minifiedEntity(food, { delete: true }),
            minifiedEntity(player, { stats: true, timers: true }),
        ],
        {
            publishTo: nearbyPlayerIds,
        },
    );
}

function canEatItem(player: PlayerEntity, food: ItemEntity): [boolean, string] {
    if (!isItemInInventory(food, player)) {
        return [false, `You don't have ${food.item}`];
    } else if (!isItemFood(food)) {
        return [false, `You can't eat ${food.name}`];
    }
    return [true, ""];
}
