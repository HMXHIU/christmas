import type {
    EntityStats,
    Monster,
    Player,
} from "$lib/server/crossover/redis/entities";
import { clone, isNumber, mergeWith, uniq } from "lodash-es";
import type { Abilities } from "./abilities";
import type { Actions } from "./actions";
import {
    attributesFromDemographics,
    skillsFromDemographics,
} from "./demographic";
import { MS_PER_TICK } from "./settings";
import { BASE_ATTRIBUTES, MAX_POSSIBLE_AP } from "./settings/entity";
import {
    abilitiesFromSkills,
    actionsFromSkills,
    attributesFromSkills,
    type SkillLines,
} from "./skills";

export {
    entityAbilities,
    entityActions,
    entityActualAp,
    entityAttributes,
    entityLevel,
    entityStats,
    mergeNumericAdd,
    recoverAp,
    type Attribute,
    type Attributes,
};

type Attribute = "dex" | "str" | "con" | "fth" | "int";
type Attributes = Record<Attribute, number>;

function recoverAp(
    ap: number,
    maxAp: number,
    apclk: number,
    now: number,
): number {
    return Math.min(maxAp, Math.floor(ap + (now - apclk) / MS_PER_TICK));
}

function entityActualAp(
    entity: Player | Monster,
    opts?: { now?: number; maxAp?: number },
): number {
    const now = opts?.now ?? Date.now();
    const maxAp = opts?.maxAp ?? entityStats(entity).ap;
    return recoverAp(entity.ap, maxAp, entity.apclk, now);
}

function entityLevel(entity: Player | Monster): number {
    // Entity's level is its highest skill level
    return Math.max(1, ...Object.values(entity.skills));
}

function entityStats(entity: Player | Monster): EntityStats {
    const { con, dex, int, fth, str } = entityAttributes(entity);

    const conModifier = Math.floor((con - 10) / 2);
    const dexModifier = Math.floor((dex - 10) / 2);
    const intModifier = Math.floor((int - 10) / 2);
    const fthModifier = Math.floor((fth - 10) / 2);
    const strModifier = Math.floor((str - 10) / 2);
    const level = entityLevel(entity);

    // Calculate HP based on CON and level
    const hp = level * (10 + conModifier);

    // Calculate MP based on the maximum of INT, WIS, and CHA, and level
    const mp = level * (10 + Math.floor(Math.max(intModifier, fthModifier)));

    // Calculate ST based on a mix of STR, DEX, and CON
    const st =
        level *
        (10 + Math.floor((strModifier + dexModifier + conModifier) / 3));

    return {
        hp,
        mp,
        st,
        ap: Math.min(4 + Math.floor(level / 10), MAX_POSSIBLE_AP),
        apclk: entity.apclk,
    };
}

function mergeNumericAdd(s: any, d: any) {
    if (isNumber(s) && isNumber(d)) {
        return s + d;
    }
    return s ?? d ?? 0;
}

function entitySkills(
    entity: Player | Monster,
): Partial<Record<SkillLines, number>> {
    // Add abilities from demographics
    if ("player" in entity) {
        // Add skill levels from demographics (additive)
        return mergeWith(
            { ...entity.skills }, // mergeWith will modify entity.skills
            skillsFromDemographics({
                race: entity.race,
                gender: entity.gen,
                archetype: entity.arch,
            }),
            mergeNumericAdd,
        );
    }

    return entity.skills;
}

function entityAttributes(entity: Player | Monster): Attributes {
    // Add attributes from skills
    let attributes: Attributes = mergeWith(
        clone(BASE_ATTRIBUTES),
        attributesFromSkills(entitySkills(entity)),
        mergeNumericAdd,
    );

    // Add attributes from demographics
    if ("player" in entity) {
        attributes = mergeWith(
            attributes,
            attributesFromDemographics({
                race: entity.race,
                gender: entity.gen,
                archetype: entity.arch,
            }),
            mergeNumericAdd,
        );
    }

    return attributes;
}

function entityAbilities(entity: Player | Monster): Abilities[] {
    return uniq(abilitiesFromSkills(entitySkills(entity)));
}

function entityActions(entity: Player | Monster): Actions[] {
    return uniq(actionsFromSkills(entitySkills(entity)));
}
