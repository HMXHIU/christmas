import type { Abilities } from "./abilities";
import type { Actions } from "./actions";
import { type Attribute, type Attributes } from "./entity";
import { skillLines } from "./settings/skills";
import type { Currency } from "./types";

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
    | "draconic";

const SkillLinesEnum = [
    "exploration",
    "firstaid",
    "dirtyfighting",
    "beast",
    "arachnid",
    "draconic",
] as const;

interface SkillLine {
    skillLine: SkillLines;
    currency: Currency[];
    description: string;
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

const generalLearningDialogues: Record<number, string[]> = {
    2: [
        "${teacher.name} begins your training in ${skill.description}...",
        "You listen intently as ${teacher.name} explains the fundamentals.",
        "Practicing the basics, you feel your understanding grow.",
        "A spark of excitement ignites as you grasp the core concepts.",
        "${teacher.name} nods approvingly, 'You've taken your first steps, ${player.name}.'",
    ],
    4: [
        "${teacher.name} introduces more advanced aspects of ${skill.description}.",
        "The challenges increase, but so does your determination.",
        "You push through difficulties, feeling your skills sharpen.",
        "A sense of accomplishment washes over you as you master new techniques.",
        "'You're making excellent progress, ${player.name},' ${teacher.name} commends.",
    ],
    6: [
        "${teacher.name} presents you with complex scenarios to test your ${skill.description} skills.",
        "You apply your knowledge creatively, finding novel solutions.",
        "The boundaries of your abilities expand, revealing new possibilities.",
        "Confidence grows as you handle situations that once seemed impossible.",
        "${teacher.name} smiles proudly, 'You're becoming a true adept, ${player.name}.'",
    ],
    8: [
        "'It's time to push your limits,' ${teacher.name} announces, eyes gleaming.",
        "You face grueling challenges that test every aspect of your ${skill.description} ability.",
        "Sweat beads on your brow as you pour every ounce of skill into the task.",
        "Exhausted but triumphant, you realize how far you've come.",
        "'You're among the elite now, ${player.name},' ${teacher.name} says with respect.",
    ],
    10: [
        "${teacher.name} leads you to a sacred place to impart the final secrets of ${skill.description}.",
        "Ancient knowledge combines with your experience, elevating your understanding.",
        "You feel a profound shift as you grasp the deepest mysteries of your craft.",
        "Power flows through you as you demonstrate mastery beyond anything you've known.",
        "${teacher.name} bows slightly, 'You've surpassed me, ${player.name}. The path forward is yours to define.'",
    ],
};
