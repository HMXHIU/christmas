import type { Abilities } from "./abilities";
import type { Actions } from "./actions";
import { type Attribute, type Attributes } from "./entity";
import { skillLines } from "./settings/skills";

export {
    abilitiesFromSkills,
    actionsFromSkills,
    attributesFromSkills,
    type SkillLine,
    type SkillLines,
};

type SkillLines =
    | "exploration"
    | "firstaid"
    | "dirtyfighting"
    | "beast"
    | "arachnid"
    | "draconic";

interface SkillLine {
    skillLine: SkillLines;
    description: string;
    abilitiesAtSkillLevel?: Record<number, Abilities[]>;
    actionsAtSkillLevel?: Record<number, Actions[]>;
    attributesAtSkillLevel?: Record<number, Partial<Attributes>>;
}

function attributesFromSkills(
    skills: Partial<Record<SkillLines, number>>,
): Attributes {
    const attributes: Attributes = { str: 0, dex: 0, con: 0, int: 0, fth: 0 };

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

function actionsFromSkills(
    skills: Partial<Record<SkillLines, number>>,
): Actions[] {
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

function abilitiesFromSkills(
    skills: Partial<Record<SkillLines, number>>,
): Abilities[] {
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
