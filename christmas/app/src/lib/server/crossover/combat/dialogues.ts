import {
    type BodyPart,
    type ItemEntity,
    type MonsterEntity,
    type PlayerEntity,
} from "$lib/crossover/types";
import type { DamageType } from "$lib/crossover/world/abilities";
import type { Genders } from "$lib/crossover/world/demographic";

export { entityPronoun, generateHitMessage, generateMissMessage };

/**
 * This functions generate server messages for hit and miss for actions and abilites.
 * For messages due to buffs and debuffs - these are generated and displayed on the client side.
 *
 */

const damgeTypeToHitVerb: Record<DamageType, string> = {
    blunt: "bashes",
    piercing: "pierces",
    slashing: "slashes",
    normal: "strikes",
    fire: "singes",
    ice: "freezes",
    lightning: "electrocutes",
    healing: "heals",
    poison: "poisons",
    radiant: "sears",
    necrotic: "drains",
};

const genderToPronoun: Record<Genders, string> = {
    male: "his",
    female: "her",
};

function entityPronoun(
    entity: PlayerEntity | MonsterEntity | ItemEntity,
): string {
    if ("player" in entity) {
        return genderToPronoun[(entity as PlayerEntity).gen];
    } else if ("monster" in entity) {
        return "their";
    } else {
        return "its";
    }
}

function entityHitNoun(
    entity: PlayerEntity | MonsterEntity | ItemEntity,
    bodyPartHit?: BodyPart,
): string {
    if ("item" in entity) {
        return entity.name;
    } else {
        if (bodyPartHit === "legs" || bodyPartHit === "arms") {
            return `${entity.name}'s ${bodyPartHit}`;
        } else {
            return entity.name;
        }
    }
}

function describeDamage(damage: number): string {
    if (damage > 0) {
        return `dealing ${damage} damage`;
    } else if (damage < 0) {
        return `healing ${Math.abs(damage)} health`;
    } else {
        return "it tickles";
    }
}

function generateHitMessage({
    attacker,
    target,
    weapon,
    bodyPartHit,
    damage,
    damageType,
}: {
    attacker: PlayerEntity | MonsterEntity;
    target: PlayerEntity | MonsterEntity | ItemEntity;
    bodyPartHit: BodyPart;
    damage: number;
    damageType: DamageType;
    weapon?: ItemEntity;
}): string {
    const hitVerb = damgeTypeToHitVerb[damageType] ?? "strikes";
    if (weapon) {
        return `${attacker.name} ${hitVerb} ${entityHitNoun(target, bodyPartHit)} with ${entityPronoun(attacker)} ${weapon.name}, ${describeDamage(damage)}!`;
    }
    return `${attacker.name} ${hitVerb} ${entityHitNoun(target, bodyPartHit)}, ${describeDamage(damage)}!`;
}

function generateMissMessage(
    attacker: PlayerEntity | MonsterEntity,
    target: PlayerEntity | MonsterEntity | ItemEntity,
    weapon?: ItemEntity,
): string {
    const missReasons = [
        "misses by a hair",
        "is expertly dodged",
        "it fails to connect",
        "is blocked",
    ];
    const missReason =
        missReasons[Math.floor(Math.random() * missReasons.length)];
    if (weapon) {
        return `${attacker.name} attacks ${target.name} with ${entityPronoun(attacker)} ${weapon.name} but ${missReason}.`;
    } else {
        return `${attacker.name} attacks ${target.name} but ${missReason}.`;
    }
}

// // TODO: Move this to game instead
// function generateDebuffMessage(
//     target: PlayerEntity | MonsterEntity,
//     debuffs: Debuff[],
// ): string {
//     if (debuffs.length > 0) {
//         return `${target.name} is ${debuffs.map((d) => debuffEffects[d]).join(", ")}!`;
//     }
//     return "";
// }

// const debuffEffects: Record<Debuff, string> = {
//     weakness: "weakened",
//     crippled: "crippled",
//     paralyzed: "paralyzed",
//     blinded: "blinded",
//     wet: "drenched",
//     burning: "set ablaze",
//     poisoned: "poisoned",
//     frozen: "frozen",
//     bleeding: "bleeding",
//     stunned: "stunned",
//     confused: "confused",
//     charmed: "charmed",
//     frightened: "frightened",
//     exhausted: "exhausted",
//     silenced: "silenced",
//     diseased: "diseased",
// };
