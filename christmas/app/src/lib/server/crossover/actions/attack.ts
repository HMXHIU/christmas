import type { Actor, Creature } from "$lib/crossover/types";
import { entityInRange, isEntityAlive } from "$lib/crossover/utils";
import { MS_PER_TICK } from "$lib/crossover/world/settings";
import { actions } from "$lib/crossover/world/settings/actions";
import {
    type ActorEntity,
    type CreatureEntity,
    type PlayerEntity,
} from "$lib/server/crossover/types";
import { sleep } from "$lib/utils";
import { setEntityBusy } from "..";
import { resolveCombat } from "../combat";
import { publishFeedEvent } from "../events";
import { equippedWeapons } from "../redis/queries";
import { fetchEntity } from "../redis/utils";

export { attack };

function canAttackTarget(attacker: Creature, target: Actor): [boolean, string] {
    // Out of range
    if (!entityInRange(attacker, target, actions.attack.range)[0]) {
        return [false, `${target.name} is out of range`];
    }

    // Entity is already destroyed/dead
    if (!isEntityAlive(target)) {
        if ("player" in target || "monster" in target) {
            return [false, `${target.name} is already dead`];
        } else {
            return [false, `${target.name} is already destroyed`];
        }
    }

    return [true, ""];
}

async function attack(
    creature: CreatureEntity,
    target: string,
    options?: {
        now?: number;
    },
) {
    // Check if can attack
    const targetEntity = (await fetchEntity(target)) as ActorEntity;
    const [ok, error] = canAttackTarget(creature, targetEntity);
    if (!ok) {
        if (creature.player) {
            await publishFeedEvent((creature as PlayerEntity).player, {
                type: "error",
                message: error,
            });
        }
        return; // do not proceed
    }

    // Set busy
    creature = (await setEntityBusy({
        entity: creature,
        action: actions.attack.action,
        now: options?.now,
    })) as PlayerEntity;

    // Get creature equipped weapons or unarmed
    let weapons = await equippedWeapons(creature);

    // Inform weapon durability
    for (const weapon of weapons) {
        if (weapon.dur <= 0) {
            if (creature.player) {
                await publishFeedEvent(creature.player, {
                    type: "message",
                    message: `Your ${weapon.name} feels brittle, too damaged to be of any use.`,
                });
            }
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
        await resolveCombat(creature, targetEntity, {
            attack: { action: "attack", weapon },
        });
    }
}
