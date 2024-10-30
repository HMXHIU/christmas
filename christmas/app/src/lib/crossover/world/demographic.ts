import type { Skills } from "../types";
import type { Abilities } from "./abilities";
import type { Actions } from "./actions";
import type { Attribute, Attributes } from "./entity";
import { abilitiesFromSkills, actionsFromSkills } from "./skills";

export {
    abilitiesFromDemographics,
    actionsFromDemographics,
    archetypes,
    ArchetypesEnum,
    attributesFromDemographics,
    genders,
    GendersEnum,
    races,
    RacesEnum,
    skillsFromDemographics,
    type Archetype,
    type Archetypes,
    type Gender,
    type Genders,
    type Race,
    type Races,
};

function attributesFromDemographics({
    race,
    gender,
    archetype,
}: {
    race: Races;
    gender: Genders;
    archetype: Archetypes;
}): Attributes {
    const attributes: Attributes = {
        str: 0,
        dex: 0,
        con: 0,
        mnd: 0,
        cha: 0,
        fth: 0,
    };

    // Add attributes from gender
    for (const [attr, mod] of Object.entries(genders[gender].attributes)) {
        attributes[attr as Attribute] += mod;
    }
    // Add attributes from archetype
    for (const [attr, mod] of Object.entries(
        archetypes[archetype].attributes,
    )) {
        attributes[attr as Attribute] += mod;
    }

    // Add attributes from race
    for (const [attr, mod] of Object.entries(races[race].attributes)) {
        attributes[attr as Attribute] += mod;
    }

    return attributes;
}

function skillsFromDemographics({
    race,
    gender,
    archetype,
}: {
    race: Races;
    gender: Genders;
    archetype: Archetypes;
}): Skills {
    return races[race].skills;
}

function abilitiesFromDemographics({
    race,
    gender,
    archetype,
}: {
    race: Races;
    gender: Genders;
    archetype: Archetypes;
}): Abilities[] {
    return abilitiesFromSkills(
        skillsFromDemographics({
            race,
            gender,
            archetype,
        }),
    );
}

function actionsFromDemographics({
    race,
    gender,
    archetype,
}: {
    race: Races;
    gender: Genders;
    archetype: Archetypes;
}): Actions[] {
    return actionsFromSkills(
        skillsFromDemographics({
            race,
            gender,
            archetype,
        }),
    );
}

/*
 * Gender
 */
type Genders = "male" | "female";
const GendersEnum = ["male", "female"] as const; // for use in zod schema

interface Gender {
    gender: Genders;
    label: string;
    description: string;
    attributes: Partial<Attributes>;
}

const genders: Record<Genders, Gender> = {
    male: {
        gender: "male",
        label: "Male",
        description: "Male",
        attributes: {
            str: 1,
            mnd: 1,
        },
    },
    female: {
        gender: "female",
        label: "Female",
        description: "Female",
        attributes: {
            cha: 1,
            dex: 1,
        },
    },
};

/*
 * Race
 */

type Races = "human" | "elf";
const RacesEnum = ["human", "elf"] as const;

interface Race {
    race: Races;
    label: string;
    description: string;
    attributes: Partial<Attributes>;
    skills: Skills;
}

const races: Record<Races, Race> = {
    human: {
        race: "human",
        label: "Human",
        description: "Adaptable and diverse.",
        attributes: {
            str: 1,
            dex: 1,
            con: 1,
            mnd: 1,
            cha: 1,
            fth: 1,
        },
        skills: {
            exploration: 1,
            firstaid: 1,
        },
    },
    elf: {
        race: "elf",
        label: "Elf",
        description:
            "Graceful and long-lived, with a deep connection to nature and magic.",
        attributes: {
            dex: 2,
            cha: 2,
            fth: 2,
        },
        skills: {
            exploration: 1,
        },
    },
};

/*
 * Archetype
 */

type Archetypes =
    | "believer"
    | "protagonist"
    | "chosenOne"
    | "veteran"
    | "mage"
    | "rougueAntiHero"
    | "stuckUpPaladin";

const ArchetypesEnum = [
    "believer",
    "protagonist",
    "chosenOne",
    "veteran",
    "mage",
    "rougueAntiHero",
    "stuckUpPaladin",
] as const;

interface Archetype {
    archetype: Archetypes;
    label: string;
    description: string;
    attributes: Partial<Attributes>;
}

const archetypes: Record<Archetypes, Archetype> = {
    believer: {
        archetype: "believer",
        label: "The Believer",
        description:
            "You believe in every conspiracy or supernatural theory, often leading the group into dangerous situations.",
        attributes: {
            con: 2,
            str: 2,
            dex: 2,
            fth: 2,
            mnd: -2,
        },
    },
    protagonist: {
        archetype: "protagonist",
        label: "The Protagonist",
        description:
            "You always seem to survive to confront the antagonist, often embodying innocence and resilience.",
        attributes: {
            str: 2,
            con: 2,
            dex: 1,
            fth: 1,
        },
    },
    chosenOne: {
        archetype: "chosenOne",
        label: "The Chosen One",
        description:
            "Foretold in prophecies, often possessing unique powers crucial to the story, or so you think.",
        attributes: {
            dex: 2,
            str: 2,
            con: 2,
        },
    },
    stuckUpPaladin: {
        archetype: "stuckUpPaladin",
        label: "Stuck Up Paladin",
        description:
            "Embodies strict moral codes and can often come off as condescending or overly righteous.",
        attributes: {
            str: 4,
            fth: 2,
        },
    },
    veteran: {
        archetype: "veteran",
        label: "The Veteran",
        description:
            "A seasoned warrior who has seen many battles and carries the scars of experience.",
        attributes: {
            dex: 3,
            str: 3,
        },
    },
    rougueAntiHero: {
        archetype: "rougueAntiHero",
        label: "The Rogue Anti-Hero",
        description:
            "Charismatic and morally ambiguous, you operate outside the law. You have a strong personal code due to your troubled past.",
        attributes: {
            dex: 4,
            mnd: 2,
        },
    },
    mage: {
        archetype: "mage",
        label: "The Mage",
        description:
            "You are a master of arcane knowledge, wielding powerful spells to manipulate reality, control the battlefield, and unravel ancient mysteries.",
        attributes: {
            cha: 4,
            fth: 2,
            dex: 2,
            str: -2,
        },
    },
};
