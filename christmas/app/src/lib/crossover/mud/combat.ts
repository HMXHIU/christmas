import { entityLinguistics } from "$lib/crossover/mud/entities";
import { type Actor, type BodyPart, type Item } from "$lib/crossover/types";
import type { Abilities } from "$lib/crossover/world/abilities";
import type { DamageType } from "$lib/crossover/world/combat";
import { substituteVariables } from "$lib/utils";
import { getEntityId } from "../utils";

export { generateAttackMessage };

const damageTypeToHitVerb: Record<DamageType, { base: string; third: string }> =
    {
        blunt: { base: "bash", third: "bashes" },
        piercing: { base: "pierce", third: "pierces" },
        slashing: { base: "slash", third: "slashes" },
        normal: { base: "strike", third: "strikes" },
        fire: { base: "singe", third: "singes" },
        ice: { base: "freeze", third: "freezes" },
        lightning: { base: "electrocute", third: "electrocutes" },
        healing: { base: "heal", third: "heals" },
        poison: { base: "poison", third: "poisons" },
        radiant: { base: "sear", third: "sears" },
        necrotic: { base: "drain", third: "drains" },
        water: { base: "soak", third: "soaks" },
    };

function describeDamage(damage: number): string {
    if (damage > 0) {
        return `<span style="color:red">[${damage}]</span>`;
    } else if (damage < 0) {
        return `<span style="color:red">[${Math.abs(damage)}]</span>`;
    } else {
        return "";
    }
}
function hitVerb({
    damageType,
    ability,
    form,
}: {
    damageType?: DamageType;
    ability?: Abilities;
    form?: "base" | "third";
}): string {
    form = form ?? "base";
    if (damageType) {
        return damageTypeToHitVerb[damageType][form];
    }
    // TODO: use ability dialogue
    if (ability) {
        return ability;
    }
    return form === "base" ? "strike" : "strikes";
}

const missReasons = [
    "misses by a hair",
    "is expertly dodged",
    "it fails to connect",
    "is blocked",
];

function generateAttackMessage({
    source,
    target,
    weapon,
    bodyPart,
    damage,
    damageType,
    ability,
    selfId,
    miss,
}: {
    source: Actor;
    target: Actor;
    bodyPart?: BodyPart;
    damageType?: DamageType;
    damage?: number;
    weapon?: Item;
    ability?: Abilities;
    selfId?: string;
    miss?: boolean;
}): string {
    const targetPronoun =
        source === target ? "${target.pronoun.reflexive}" : "${target.subject}";
    const verbForm = getEntityId(source)[0] === selfId ? "base" : "third";

    // Add hit message (TODO: Check for custom ability or weapon dialogues and use it instead of default)
    let message = miss
        ? `\${source.subject} attempt to ${hitVerb({ damageType, ability, form: verbForm })} ${targetPronoun}`
        : `\${source.subject} ${hitVerb({ damageType, ability, form: verbForm })} ${targetPronoun}`;

    // Add weapon message
    if (weapon) {
        message += ` with \${source.pronoun.possessive} ${weapon.name}`;
    }

    // Miss message
    if (miss) {
        message += `but ${missReasons[Math.floor(Math.random() * missReasons.length)]}`;
    }
    // Add bodyPart and damage numbers if hit
    else {
        // Add bodyPart message
        if (source !== target && bodyPart !== "torso") {
            message += `, striking \${target.pronoun.possessive} ${bodyPart}`;
        }
        // Add damage numbers
        if (damage != null) {
            message += ` ${describeDamage(damage)}`;
        }
    }

    return (
        substituteVariables(message, {
            source: entityLinguistics(source, selfId),
            target: entityLinguistics(target, selfId),
        }) + "."
    );
}
