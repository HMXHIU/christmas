import {
    type GameRedisEntities,
    type PlayerEntity,
} from "$lib/crossover/types";
import { entityInRange } from "$lib/crossover/utils";
import { MS_PER_TICK } from "$lib/crossover/world/settings";
import { actions } from "$lib/crossover/world/settings/actions";
import { sleep } from "$lib/utils";
import { setEntityBusy } from "..";
import { resolveCombat } from "../combat";
import { publishFeedEvent } from "../events";
import { equippedWeapons } from "../redis/queries";
import { fetchEntity } from "../redis/utils";

export { attack };

async function attack(
    player: PlayerEntity,
    target: string,
    options?: {
        now?: number;
    },
) {
    // Set busy
    player = (await setEntityBusy({
        entity: player,
        action: actions.attack.action,
        now: options?.now,
    })) as PlayerEntity;

    const targetEntity = (await fetchEntity(target)) as GameRedisEntities;

    // Check target is in range
    if (
        !entityInRange(player, targetEntity, actions.attack.range)[0] &&
        "player" in player
    ) {
        publishFeedEvent(player.player, {
            type: "error",
            message: `${targetEntity.name} is out of range`,
        });
        return;
    }

    // Get player equipped weapons or unarmed
    let weapons = await equippedWeapons(player);

    // Inform weapon durability
    for (const weapon of weapons) {
        if (weapon.dur <= 0) {
            publishFeedEvent(player.player, {
                type: "message",
                message: `Your ${weapon.name} feels brittle, too damaged to be of any use.`,
            });
        }
    }

    weapons = weapons.filter((i) => i.dur > 0);
    const weaponsOrUnarmed = weapons.length > 0 ? weapons : [undefined]; // [undefined] means an unarmed attack

    // Resolve combat for each weapon
    for (const weapon of weaponsOrUnarmed) {
        // Sleep for the duration of the attack
        await sleep(
            (MS_PER_TICK * actions.attack.ticks) / weaponsOrUnarmed.length,
        );
        // Resolve combat
        await resolveCombat(player, targetEntity, {
            attack: { action: "attack", weapon },
        });
    }
}
