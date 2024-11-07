import type { Currency, Skills } from "../types";
import type { Abilities } from "./abilities";
import type { Actions } from "./actions";
import { type Attribute, type Attributes } from "./entity";
import { generalLearningDialogues, skillLines } from "./settings/skills";

export {
    abilitiesFromSkills,
    actionsFromSkills,
    attributesFromSkills,
    learningDialoguesForSkill,
    skillLevelProgression,
    SkillLinesEnum,
    type SkillLine,
    type SkillLines,
};

type SkillLines =
    | "exploration"
    | "firstaid"
    | "dirtyfighting"
    | "beast"
    | "arachnid"
    | "monster"
    | "draconic";

const SkillLinesEnum = [
    "exploration",
    "firstaid",
    "dirtyfighting",
    "beast",
    "monster",
    "arachnid",
    "draconic",
] as const;

interface SkillLine {
    skillLine: SkillLines;
    name: string;
    description: string;
    currency: Currency[];
    abilitiesAtSkillLevel?: Record<number, Abilities[]>;
    actionsAtSkillLevel?: Record<number, Actions[]>;
    attributesAtSkillLevel?: Record<number, Partial<Attributes>>;
    learningDialogues?: Record<number, string[]>;
}

function skillLevelProgression(level: number): number {
    const xpTable: number[] = [
        100, // Level 1
        300, // Level 2
        900, // Level 3
        2700, // Level 4
        6500, // Level 5
        14000, // Level 6
        23000, // Level 7
        34000, // Level 8
        48000, // Level 9
        64000, // Level 10
        85000, // Level 11
        100000, // Level 12
        120000, // Level 13
        140000, // Level 14
        165000, // Level 15
        195000, // Level 16
        225000, // Level 17
        265000, // Level 18
        305000, // Level 19
        355000, // Level 20
    ];
    if (level > 20) {
        return xpTable.slice(-1)[0] + 100000 * (level - 20);
    }
    return xpTable[level - 1] ?? 0;
}

function attributesFromSkills(skills: Skills): Attributes {
    const attributes: Attributes = {
        str: 0,
        dex: 0,
        con: 0,
        mnd: 0,
        fth: 0,
        cha: 0,
    };

    // Add attributes from skill lines
    for (const [skillLine, skillLevel] of Object.entries(skills)) {
        const attributesAtSkillLevel =
            skillLines[skillLine as SkillLines].attributesAtSkillLevel;
        if (attributesAtSkillLevel) {
            for (const [levelReq, attrs] of Object.entries(
                attributesAtSkillLevel,
            )) {
                if (skillLevel < parseInt(levelReq)) {
                    break;
                }
                for (const [attr, mod] of Object.entries(attrs)) {
                    attributes[attr as Attribute] += mod;
                }
            }
        }
    }

    return attributes;
}

function actionsFromSkills(skills: Skills): Actions[] {
    const actions: Actions[] = [];

    for (const [skillLine, skillLevel] of Object.entries(skills)) {
        const actionsAtSkillLevel =
            skillLines[skillLine as SkillLines].actionsAtSkillLevel;
        if (actionsAtSkillLevel) {
            for (const [levelReq, acs] of Object.entries(actionsAtSkillLevel)) {
                if (skillLevel < parseInt(levelReq)) {
                    break;
                }
                actions.push(...acs);
            }
        }
    }

    return actions;
}

function abilitiesFromSkills(skills: Skills): Abilities[] {
    const abilities: Abilities[] = [];

    for (const [skillLine, skillLevel] of Object.entries(skills)) {
        const abilitiesAtSkillLevel =
            skillLines[skillLine as SkillLines].abilitiesAtSkillLevel;
        if (abilitiesAtSkillLevel) {
            for (const [levelReq, abs] of Object.entries(
                abilitiesAtSkillLevel,
            )) {
                if (skillLevel < parseInt(levelReq)) {
                    break;
                }
                abilities.push(...abs);
            }
        }
    }

    return abilities;
}

function learningDialoguesForSkill(
    skill: SkillLines,
    skillLevel: number,
): string[] {
    const dialogues =
        skillLines[skill].learningDialogues || generalLearningDialogues;
    const levelIndices = Object.keys(dialogues)
        .map(Number)
        .sort((a, b) => a - b);

    return levelIndices.reduce(
        (result, lvlIdx) => (skillLevel >= lvlIdx ? dialogues[lvlIdx] : result),
        dialogues[levelIndices[0]],
    );
}
