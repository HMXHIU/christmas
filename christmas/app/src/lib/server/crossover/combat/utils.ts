import type { BodyPart, DieRoll, Item } from "$lib/crossover/types";
import type { ProcedureEffect } from "$lib/crossover/world/abilities";
import type { DamageType } from "$lib/crossover/world/combat";
import {
    calculateModifier,
    entityAttributes,
    entityStats,
    type Attribute,
} from "$lib/crossover/world/entity";
import {
    LOCATION_INSTANCE,
    MS_PER_TICK,
    TICKS_PER_TURN,
} from "$lib/crossover/world/settings";
import { compendium } from "$lib/crossover/world/settings/compendium";
import { BASE_ATTRIBUTES } from "$lib/crossover/world/settings/entity";
import type { EquipmentSlot } from "$lib/crossover/world/types";
import type {
    ActorEntity,
    CreatureEntity,
    ItemEntity,
    PlayerEntity,
} from "$lib/server/crossover/types";
import { closestSanctuaryMonument } from "../redis/queries";
import { random } from "../utils";
import { resolveEquipment } from "./equipment";

export {
    attackRollForProcedureEffect,
    attackRollForWeapon,
    d20,
    d4,
    determineBodyPartHit,
    determineEquipmentSlotHit,
    entityDied,
    resolveDamage,
    respawnPlayer,
    rollDice,
    rollDiceWithModifier,
};

const d20: DieRoll = {
    count: 1,
    sides: 20,
};
const d4: DieRoll = {
    count: 1,
    sides: 4,
};

const bodyPartHitProbability: Record<BodyPart, number> = {
    torso: 0.75,
    arms: 0.1,
    legs: 0.1,
    head: 0.05,
};

const bodyPartToEquipment: Record<BodyPart, EquipmentSlot[]> = {
    head: ["hd"],
    arms: ["gl", "sh"],
    legs: ["ft", "lg"],
    torso: ["ch"],
};

function determineBodyPartHit(): BodyPart {
    const roll = random();
    let cumulativeProbability = 0;
    for (const [part, probability] of Object.entries(bodyPartHitProbability)) {
        cumulativeProbability += probability;
        if (roll < cumulativeProbability) {
            return part as BodyPart;
        }
    }
    return "torso";
}

function determineEquipmentSlotHit(bodyPartHit: BodyPart): EquipmentSlot {
    const equipment = bodyPartToEquipment[bodyPartHit];
    return equipment[Math.floor(random() * equipment.length)] ?? equipment[0];
}

function rollDice(dieRoll: DieRoll): number {
    let total = 0;
    const absides = Math.abs(dieRoll.sides);
    for (let i = 0; i < dieRoll.count; i++) {
        total += Math.floor(random() * absides) + 1;
    }
    return dieRoll.sides > 0 ? total : -total;
}

function rollDiceWithModifier(dieRoll: DieRoll, entity: ActorEntity): number {
    let amt = rollDice(dieRoll);
    if (dieRoll.modifiers) {
        const mod = calculateModifier(
            dieRoll.modifiers,
            "item" in entity ? BASE_ATTRIBUTES : entityAttributes(entity),
        );
        amt = amt > 0 ? amt + mod : amt - mod;
    }
    return amt;
}

function resolveDamage({
    attacker,
    defender,
    dieRoll,
    bodyPartHit,
    equipment,
}: {
    attacker: ActorEntity;
    defender: ActorEntity;
    dieRoll: DieRoll;
    bodyPartHit?: BodyPart;
    equipment?: ItemEntity;
}): {
    damage: number;
    damageType: DamageType;
    attacker: ActorEntity;
    defender: ActorEntity;
} {
    let damage = rollDiceWithModifier(dieRoll, attacker);
    let damageType = dieRoll.damageType ?? "normal";

    // Modify damage based on body part hit
    if (bodyPartHit === "head") {
        damage *= 2;
    } else if (bodyPartHit === "arms") {
        damage *= 0.8;
    } else if (bodyPartHit === "legs") {
        damage *= 0.8;
    }

    // Factor equipment damage reduction
    if (equipment) {
        const fixed =
            compendium[equipment.prop].equipment?.damageReduction?.fixed ?? 0;
        const percent =
            compendium[equipment.prop].equipment?.damageReduction?.percent ?? 0;
        damage = Math.floor(Math.max(damage - fixed, 0) * (1 - percent));
    }

    // Damage defender
    if ("item" in defender) {
        (defender as ItemEntity).dur -= damage;
    } else {
        defender.hp -= damage;
    }

    return {
        damage,
        damageType,
        attacker,
        defender,
    };
}

function attackRollForWeapon(
    attacker: ActorEntity,
    defender: ActorEntity,
    weapon?: Item,
): {
    success: boolean;
    attackerRoll: number;
    defenderRoll: number;
} {
    const modifiers: Attribute[] = weapon
        ? (compendium[weapon.prop].dieRoll?.modifiers ?? ["str"])
        : ["str", "dex"];
    const attackerRoll = rollDiceWithModifier(
        { count: 1, sides: 20, modifiers },
        attacker,
    );
    // Dexterity is used for evasion modifier
    const defenderRoll = rollDiceWithModifier(
        { count: 1, sides: 20, modifiers: ["dex"] },
        defender,
    );
    return {
        success: attackerRoll >= defenderRoll,
        attackerRoll,
        defenderRoll,
    };
}

function attackRollForProcedureEffect(
    attacker: ActorEntity,
    defender: ActorEntity,
    procedureEffect: ProcedureEffect,
): {
    success: boolean;
    attackerRoll: number;
    defenderRoll: number;
} {
    const modifiers = procedureEffect.modifiers; // do not use the one in the die roll
    const attackerRoll = rollDiceWithModifier(
        { count: 1, sides: 20, modifiers },
        attacker,
    );
    const defenderRoll = rollDiceWithModifier(
        { count: 1, sides: 20, modifiers },
        defender,
    );
    return {
        success: attackerRoll >= defenderRoll,
        attackerRoll,
        defenderRoll,
    };
}

function entityDied(before: ActorEntity, after: ActorEntity): boolean {
    if ("item" in before) {
        return (before as ItemEntity).dur > 0 && (after as ItemEntity).dur <= 0;
    }
    return (
        (before as CreatureEntity).hp > 0 && (after as CreatureEntity).hp <= 0
    );
}

async function respawnPlayer(player: PlayerEntity): Promise<PlayerEntity> {
    // Find the closest monument of control controlled by the player's faction
    const [sanctuary, monument] = await closestSanctuaryMonument(player);
    if (monument) {
        player.loc = [monument.loc[0]];
        player.locI = LOCATION_INSTANCE;
        player.locT = monument.locT;
    }
    // Fallback if there is no faction monument
    else {
        player.loc = [sanctuary.geohash];
        player.locI = LOCATION_INSTANCE;
        player.locT = "geohash";
    }

    // Lose currencies
    player.lum = Math.floor(player.lum / 2);
    player.umb = Math.floor(player.umb / 2);
    player = Object.assign(player, entityStats(player));

    // Set player busy for (10 turns)
    player.buclk = MS_PER_TICK * TICKS_PER_TURN * 10;

    // Remove conditions
    player.cond = [];

    // Resolve equipment
    return resolveEquipment(player);
}
