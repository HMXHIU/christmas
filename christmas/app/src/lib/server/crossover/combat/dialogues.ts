import { entityPronouns } from "$lib/crossover/mud/entities";
import { type BodyPart } from "$lib/crossover/types";
import type { Abilities } from "$lib/crossover/world/abilities";
import type { DamageType } from "$lib/crossover/world/combat";
import { type ActorEntity, type ItemEntity } from "$lib/server/crossover/types";
import { random } from "../utils";

export { generateHitMessage, generateMissMessage };

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
    water: "soaks",
};

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
    attacker: ActorEntity;
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
            message = `${attacker.name} ${hitVerb({ damageType, ability })} ${entityPronouns(attacker).reflexive} with ${entityPronouns(attacker).possessive} ${weapon.name}`;
        }
        message = `${attacker.name} ${hitVerb({ damageType, ability })} ${entityPronouns(attacker).reflexive}`;
    } else {
        if (weapon) {
            message = `${attacker.name} ${hitVerb({ damageType, ability })} ${entityHitNoun(target, bodyPartHit)} with ${entityPronouns(attacker).possessive} ${weapon.name}`;
        }
        message = `${attacker.name} ${hitVerb({ damageType, ability })} ${entityHitNoun(target, bodyPartHit)}`;
    }

    if (damage != null) {
        message += `, ${describeDamage(damage)}!`;
    }
    return message;
}

function generateMissMessage(
    attacker: ActorEntity,
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
        return `${attacker.name} attacks ${target.name} with ${entityPronouns(attacker).possessive} ${weapon.name} but ${missReason}.`;
    } else {
        return `${attacker.name} attacks ${target.name} but ${missReason}.`;
    }
}
