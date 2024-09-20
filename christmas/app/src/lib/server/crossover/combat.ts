import type {
    DieRoll,
    GameRedisEntities,
    Item,
    ItemEntity,
    Monster,
    MonsterEntity,
    Player,
    PlayerEntity,
} from "$lib/crossover/types";
import { getEntityId } from "$lib/crossover/utils";
import type { Debuff, ProcedureEffect } from "$lib/crossover/world/abilities";
import type { Actions } from "$lib/crossover/world/actions";
import {
    entityAttributes,
    type Attribute,
    type Attributes,
} from "$lib/crossover/world/entity";
import { compendium } from "$lib/crossover/world/settings/compendium";
import { BASE_ATTRIBUTES } from "$lib/crossover/world/settings/entity";
import type { EquipmentSlot } from "$lib/crossover/world/types";
import { uniq } from "lodash-es";
import { equipmentQuerySet } from "./redis/queries";

export { resolveCombatAction, resolveCombatProcedureEffect };

type BodyPart = "head" | "torso" | "legs" | "arms";

const d20: DieRoll = {
    count: 1,
    sides: 20,
};
const unarmedDieRoll: DieRoll = {
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

/**
 * Returns the success of the attack and any affected entities without saving
 */
async function resolveCombatAction(
    attacker: PlayerEntity | MonsterEntity,
    defender: PlayerEntity | MonsterEntity,
    action: Actions,
    weapon?: ItemEntity,
): Promise<{
    success: boolean;
    entities: GameRedisEntities[];
}> {
    const entities: GameRedisEntities[] = []; // affected entities
    let success = false;

    // Attack action
    if (action === "attack") {
        // Attack roll
        success = attackRollForWeapon(attacker, defender, weapon).success;
        if (success) {
            // Body part roll
            const bodyPart = determineBodyPartHit();
            const equipmentSlot = determineEquipmentSlotHit(bodyPart);

            // Damage & Debuffs
            const dieRoll: DieRoll = weapon
                ? compendium[weapon.prop].dieRoll ?? unarmedDieRoll
                : unarmedDieRoll;
            const { damage, debuffs } = calculateDamageEffects(
                attacker,
                defender,
                bodyPart,
                dieRoll,
            );

            // Reduce attacker item durability
            if (weapon) {
                weapon.dur -= 1;
                entities.push(weapon);
            }

            // Reduce defender equipment durability
            const equipment = await equipmentQuerySet(
                getEntityId(defender)[0],
                [equipmentSlot],
            ).first();
            if (equipment) {
                (equipment as ItemEntity).dur -= 1;
                entities.push(equipment as ItemEntity);
            }

            // Damage & debuff defender
            defender.hp -= damage;
            defender.dbuf = uniq([...defender.dbuf, ...debuffs]); // TODO: add redis debug entry
            entities.push(defender);
        }
    }
    return { success, entities };
}

async function resolveCombatProcedureEffect(
    attacker: PlayerEntity | MonsterEntity,
    defender: PlayerEntity | MonsterEntity,
    procedureEffect: ProcedureEffect,
): Promise<{
    success: boolean;
    entities: GameRedisEntities[];
}> {
    const entities: GameRedisEntities[] = []; // affected entities
    let success = false;

    // Attack roll
    success = attackRollForProcedureEffect(
        attacker,
        defender,
        procedureEffect,
    ).success;
    if (success) {
        // Body part roll
        const bodyPart = determineBodyPartHit();
        const equipmentSlot = determineEquipmentSlotHit(bodyPart);

        // Damage & Debuffs (some effects do not have a die roll)
        if (procedureEffect.dieRoll) {
            // Abilities ignore debuffs from body part hits
            const { damage } = calculateDamageEffects(
                attacker,
                defender,
                bodyPart,
                procedureEffect.dieRoll,
            );

            // Reduce defender equipment durability
            const equipment = await equipmentQuerySet(
                getEntityId(defender)[0],
                [equipmentSlot],
            ).first();
            if (equipment) {
                (equipment as ItemEntity).dur -= 1;
                entities.push(equipment as ItemEntity);
            }

            // Damage & debuff defender
            defender.hp -= damage;
            entities.push(defender);
        }
    }

    return { success, entities };
}

function determineBodyPartHit(): BodyPart {
    const roll = Math.random();
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
    const idx = Math.floor(Math.random() * equipment.length);
    return equipment[idx] ?? equipment[0];
}

function calculateDamageEffects(
    attacker: Player | Monster,
    defender: Player | Monster,
    bodyPartHit: BodyPart,
    damageRoll: DieRoll,
): { damage: number; debuffs: Debuff[] } {
    // TODO: MINIS defender.dr TO DEFENDER AND ADD DR TO DEFENDER ROLL

    let damage = rollDice(damageRoll);
    let debuffs: Debuff[] = [];

    // Add attacker modifier
    if (damageRoll.modifiers) {
        const attackerModifier = entityAttributes(attacker);
        damage += calculateModifier(damageRoll.modifiers, attackerModifier);
    }

    // Modify damage based on body part hit
    if (bodyPartHit === "head") {
        damage *= 2;
    } else if (bodyPartHit === "arms") {
        damage *= 0.8;
        debuffs.push("weakness");
    } else if (bodyPartHit === "legs") {
        damage *= 0.8;
        debuffs.push("crippled");
    }

    return { damage: Math.floor(damage), debuffs };
}

function attackRollForWeapon(
    attacker: Player | Monster,
    defender: Player | Monster,
    weapon?: Item,
): {
    success: boolean;
    attackerRoll: number;
    attackerModifier: number;
    defenderModifier: number;
    defenderRoll: number;
} {
    // TODO: ADD AC TO DEFENDER AND ADD AC TO DEFENDER ROLL

    const attackerRoll = rollDice(d20);
    const defenderRoll = rollDice(d20);
    const attackerAttributes = entityAttributes(attacker);
    const defenderAttributes = entityAttributes(defender);
    const modifiers: Attribute[] = weapon
        ? compendium[weapon.prop].dieRoll?.modifiers ?? ["str"]
        : ["str", "dex"];
    const attackerModifier = calculateModifier(modifiers, attackerAttributes);
    const defenderModifier = calculateModifier(modifiers, defenderAttributes);

    return {
        success:
            attackerRoll + attackerModifier > defenderRoll + defenderModifier,
        attackerRoll,
        defenderRoll,
        defenderModifier,
        attackerModifier,
    };
}

function attackRollForProcedureEffect(
    attacker: Player | Monster,
    defender: Player | Monster,
    procedureEffect: ProcedureEffect,
): {
    success: boolean;
    attackerRoll: number;
    attackerModifier: number;
    defenderModifier: number;
    defenderRoll: number;
} {
    const attackerRoll = rollDice(d20);
    const defenderRoll = rollDice(d20);
    const modifiers = procedureEffect.dieRoll?.modifiers;

    if (modifiers) {
        const attackerAttributes = entityAttributes(attacker);
        const defenderAttributes = entityAttributes(defender);
        const attackerModifier = calculateModifier(
            modifiers,
            attackerAttributes,
        );
        const defenderModifier = calculateModifier(
            modifiers,
            defenderAttributes,
        );

        return {
            success:
                attackerRoll + attackerModifier >
                defenderRoll + defenderModifier,
            attackerRoll,
            defenderRoll,
            defenderModifier,
            attackerModifier,
        };
    }
    // Some procedures do not have a die roll (no modifiers), just use the d20 rolls in this case
    else {
        return {
            success: attackerRoll > defenderRoll,
            attackerRoll,
            defenderRoll,
            defenderModifier: 0,
            attackerModifier: 0,
        };
    }
}

function calculateModifier(
    modifiers: Attribute[],
    attributes: Attributes,
): number {
    return Math.floor(
        Math.max(...modifiers.map((m) => attributes[m] - BASE_ATTRIBUTES[m])) /
            2,
    );
}

function rollDice(dieRoll: DieRoll): number {
    let total = 0;
    const absides = Math.abs(dieRoll.sides);
    for (let i = 0; i < dieRoll.count; i++) {
        total += Math.floor(Math.random() * absides) + 1;
    }
    return dieRoll.sides > 0 ? total : -total;
}
