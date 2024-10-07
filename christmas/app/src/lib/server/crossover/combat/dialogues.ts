import { type BodyPart } from "$lib/crossover/types";
import type { Abilities, DamageType } from "$lib/crossover/world/abilities";
import type { Genders } from "$lib/crossover/world/demographic";
import {
    type ActorEntity,
    type CreatureEntity,
    type ItemEntity,
    type PlayerEntity,
} from "$lib/server/crossover/types";
import { random } from "../utils";

export { entityPronoun, generateHitMessage, generateMissMessage };

/**
 * This functions generate server messages for hit and miss for actions and abilites.
 * For messages due to buffs and debuffs - these are generated and displayed on the client side.
 *
 */

const damageTypeToHitVerb: Record<DamageType, string> = {
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

const genderPronouns: Record<
    "possessive" | "reflexive" | "object" | "subject",
    Record<Genders | "it", string>
> = {
    possessive: {
        male: "his",
        female: "her",
        it: "its",
    },
    reflexive: {
        male: "himself",
        female: "herself",
        it: "itself",
    },
    object: {
        male: "he",
        female: "she",
        it: "it",
    },
    subject: {
        male: "him",
        female: "her",
        it: "it",
    },
};

function entityPronoun(
    entity: ActorEntity,
    type: "possessive" | "reflexive" | "object" | "subject" = "possessive",
): string {
    if ("player" in entity) {
        return genderPronouns[type][(entity as PlayerEntity).gen];
    } else {
        return genderPronouns[type].it;
    }
}

function entityHitNoun(entity: ActorEntity, bodyPartHit?: BodyPart): string {
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
function hitVerb({
    damageType,
    ability,
}: {
    damageType?: DamageType;
    ability?: Abilities;
}): string {
    if (damageType) {
        return damageTypeToHitVerb[damageType];
    }
    if (ability) {
        return ability;
    }
    return "strikes";
}

function generateHitMessage({
    attacker,
    target,
    weapon,
    bodyPartHit,
    damage,
    damageType,
    ability,
}: {
    attacker: CreatureEntity;
    target: ActorEntity;
    bodyPartHit: BodyPart;
    damageType?: DamageType;
    damage?: number;
    weapon?: ItemEntity;
    ability?: Abilities;
}): string {
    let message = "";

    if (attacker === target) {
        if (weapon) {
            message = `${attacker.name} ${hitVerb({ damageType, ability })} ${entityPronoun(attacker, "reflexive")} with ${entityPronoun(attacker)} ${weapon.name}`;
        }
        message = `${attacker.name} ${hitVerb({ damageType, ability })} ${entityPronoun(attacker, "reflexive")}`;
    } else {
        if (weapon) {
            message = `${attacker.name} ${hitVerb({ damageType, ability })} ${entityHitNoun(target, bodyPartHit)} with ${entityPronoun(attacker)} ${weapon.name}`;
        }
        message = `${attacker.name} ${hitVerb({ damageType, ability })} ${entityHitNoun(target, bodyPartHit)}`;
    }

    if (damage != null) {
        message += `, ${describeDamage(damage)}!`;
    }
    return message;
}

function generateMissMessage(
    attacker: CreatureEntity,
    target: ActorEntity,
    weapon?: ItemEntity,
): string {
    const missReasons = [
        "misses by a hair",
        "is expertly dodged",
        "it fails to connect",
        "is blocked",
    ];
    const missReason = missReasons[Math.floor(random() * missReasons.length)];
    if (weapon) {
        return `${attacker.name} attacks ${target.name} with ${entityPronoun(attacker)} ${weapon.name} but ${missReason}.`;
    } else {
        return `${attacker.name} attacks ${target.name} but ${missReason}.`;
    }
}

// // TODO: Move this to game instead
// function generateDebuffMessage(
//     target: CreatureEntity,
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
