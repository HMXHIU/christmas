import type { SkillLine, SkillLines } from "../skills";

export { skillLines };

const skillLines: Record<SkillLines, SkillLine> = {
    firstaid: {
        skillLine: "firstaid",
        description: "First Aid",
        abilitiesAtSkillLevel: {
            1: "bandage",
        },
    },
    exploration: {
        skillLine: "exploration",
        description: "Exploration",
        abilitiesAtSkillLevel: {
            1: "bandage",
        },
    },
    dirtyfighting: {
        skillLine: "dirtyfighting",
        description: "Dirty Fighting",
        abilitiesAtSkillLevel: {
            1: "eyePoke",
        },
    },
};
