import type {
    Creature,
    Currency,
    EntityStats,
    Monster,
    Player,
    Skills,
    Stat,
} from "$lib/crossover/types";
import { isNumber, mergeWith, uniq } from "lodash-es";
import type { Abilities } from "./abilities";
import type { Actions } from "./actions";
import { hostility, type Affinity } from "./affinities";
import {
    attributesFromDemographics,
    skillsFromDemographics,
} from "./demographic";
import { factions } from "./settings/affinities";
import { bestiary } from "./settings/bestiary";
import { BASE_ATTRIBUTES } from "./settings/entity";
import {
    abilitiesFromSkills,
    actionsFromSkills,
    attributesFromSkills,
} from "./skills";

export {
    calculateModifier,
    carryingCapacity,
    describeResource,
    entityAbilities,
    entityActions,
    entityAffinity,
    entityAttributes,
    entityCurrencyReward,
    entityLevel,
    entitySkills,
    entityStats,
    isHostile,
    mergeAdditive,
    mergeNumericAdd,
    resetEntityStats,
    type Attribute,
    type Attributes,
};

type Attribute = "dex" | "str" | "con" | "fth" | "mnd" | "cha";
type Attributes = Record<Attribute, number>;

type EntitySkillsInput =
    | Pick<Player, "player" | "skills" | "race" | "gen" | "arch" | "eqattr">
    | Pick<Monster, "skills">;

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

function entityLevel(entity: Creature): number {
    // Entity's level is its highest skill level
    return Math.max(1, ...Object.values(entity.skills));
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

function resetEntityStats(entity: Creature): Creature {
    return Object.assign(entity, entityStats(entity));
}

function entityStats(entity: Creature): EntityStats {
    const attributes = entityAttributes(entity);
    const level = entityLevel(entity);
    return {
        hp: level * (10 + calculateModifier(["con"], attributes)),
        mnd: 1 + Math.floor(level / 4) + calculateModifier(["mnd"], attributes),
        cha: 1 + Math.floor(level / 4) + calculateModifier(["cha"], attributes),
    };
}

function mergeAdditive<T>(u: T, v: T): T {
    return mergeWith(
        { ...u }, // mergeWith will modify in place, do a shallow copy
        v,
        mergeNumericAdd,
    );
}

function mergeNumericAdd(s: any, d: any) {
    if (isNumber(s) && isNumber(d)) {
        return s + d;
    }
    return s ?? d ?? 0;
}

function entitySkills(entity: EntitySkillsInput): Skills {
    // Add abilities from demographics (monster does not have skills from demographics)
    if ("player" in entity) {
        // Add skill levels from demographics
        return mergeAdditive(
            entity.skills,
            skillsFromDemographics({
                race: entity.race,
                gender: entity.gen,
                archetype: entity.arch,
            }),
        );
    }

    return entity.skills;
}

function entityAttributes(entity: EntitySkillsInput): Attributes {
    // Add from skills
    let attributes: Attributes = mergeAdditive(
        BASE_ATTRIBUTES,
        attributesFromSkills(entitySkills(entity)),
    );

    if ("player" in entity) {
        // Add from demographics
        attributes = mergeAdditive(
            attributes,
            attributesFromDemographics({
                race: entity.race,
                gender: entity.gen,
                archetype: entity.arch,
            }),
        );

        // Add from equipment
        if (entity.eqattr) {
            attributes = mergeAdditive(attributes, entity.eqattr) as Attributes;
        }
    }

    return attributes;
}

function entityAbilities(entity: EntitySkillsInput): Abilities[] {
    return uniq(abilitiesFromSkills(entitySkills(entity)));
}

function entityActions(entity: EntitySkillsInput): Actions[] {
    return uniq(actionsFromSkills(entitySkills(entity)));
}

function entityCurrencyReward(entity: Creature): Record<Currency, number> {
    const moral = entityAffinity(entity).moral;
    const level = entityLevel(entity);
    if (moral === "evil") {
        return {
            lum: Math.ceil(level) * 10,
            umb: 0,
        };
    }
    return {
        lum: 0,
        umb: Math.ceil(level) * 10,
    };
}

function entityAffinity(entity: Creature): Affinity {
    return factions[
        "player" in entity ? entity.fac : bestiary[entity.beast].faction
    ].affinity;
}

function isHostile(a: Creature, b: Creature): [boolean, number] {
    const aggro = hostility(entityAffinity(a), entityAffinity(b));
    return [aggro >= 2, aggro];
}

function carryingCapacity(entity: Creature): number {
    return 20 + 10 * (entityAttributes(entity).str - 10);
}
