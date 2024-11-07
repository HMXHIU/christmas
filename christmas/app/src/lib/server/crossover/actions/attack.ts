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

export { attack };

async function attack(
    entity: CreatureEntity,
    target: ActorEntity,
    options?: {
        now?: number;
    },
) {
    // Check if can attack
    const [ok, error] = canAttackTarget(entity, target);
    if (!ok) {
        if (entity.player) {
            await publishFeedEvent((entity as PlayerEntity).player, {
                type: "error",
                message: error,
            });
        }
        return; // do not proceed
    }

    // Set busy
    entity = (await setEntityBusy({
        entity,
        action: actions.attack.action,
        now: options?.now,
    })) as PlayerEntity;

    // Get entity equipped weapons or unarmed
    let weapons = await equippedWeapons(entity);

    // Inform weapon durability
    for (const weapon of weapons) {
        if (weapon.dur <= 0) {
            if (entity.player) {
                await publishFeedEvent(entity.player, {
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
        await resolveCombat(entity, target, {
            attack: { action: "attack", weapon },
        });
    }
}

function canAttackTarget(
    attacker: CreatureEntity,
    target: ActorEntity,
): [boolean, string] {
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
