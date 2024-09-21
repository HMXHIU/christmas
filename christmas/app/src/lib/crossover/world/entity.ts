import type {
    Currency,
    EntityStats,
    Monster,
    Player,
    Stat,
} from "$lib/crossover/types";
import { calculateModifier } from "$lib/server/crossover/combat/utils";
import { clone, isNumber, mergeWith, uniq } from "lodash-es";
import type { Abilities } from "./abilities";
import type { Actions } from "./actions";
import {
    attributesFromDemographics,
    skillsFromDemographics,
} from "./demographic";
import { BASE_ATTRIBUTES } from "./settings/entity";
import {
    abilitiesFromSkills,
    actionsFromSkills,
    attributesFromSkills,
    type SkillLines,
} from "./skills";

export {
    describeResource,
    entityAbilities,
    entityActions,
    entityAttributes,
    entityLevel,
    entityStats,
    mergeNumericAdd,
    resetEntityStats,
    type Attribute,
    type Attributes,
};

type Attribute = "dex" | "str" | "con" | "fth" | "mnd" | "cha";
type Attributes = Record<Attribute, number>;

const describeResource: Record<Stat | Attribute | Currency, string> = {
    mnd: "mind",
    cha: "chaos",
    hp: "health",
    dex: "dexterity",
    str: "strength",
    con: "constitution",
    fth: "faith",
    lum: "lumina",
    umb: "umbra",
};

function entityLevel(entity: Player | Monster): number {
    // Entity's level is its highest skill level
    return Math.max(1, ...Object.values(entity.skills));
}

function resetEntityStats(entity: Player | Monster): Player | Monster {
    return Object.assign(entity, entityStats(entity));
}

function entityStats(entity: Player | Monster): EntityStats {
    const attributes = entityAttributes(entity);
    const level = entityLevel(entity);
    return {
        hp: level * (10 + calculateModifier(["con"], attributes)),
        mnd: calculateModifier(["mnd"], attributes),
        cha: calculateModifier(["cha"], attributes),
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
