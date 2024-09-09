import type { SkillLine, SkillLines } from "../skills";

export { skillLines };

const skillLines: Record<SkillLines, SkillLine> = {
    // General skills
    firstaid: {
        skillLine: "firstaid",
        description: "First Aid",
        abilitiesAtSkillLevel: {
            1: ["bandage"],
        },
        attributesAtSkillLevel: {
            2: { con: 1 },
            4: { con: 1 },
            6: { con: 1 },
            8: { con: 1 },
            9: { con: 1 },
            10: { con: 1 },
        },
    },
    exploration: {
        skillLine: "exploration",
        description: "Exploration",
        actionsAtSkillLevel: {
            1: ["look", "say", "move", "inventory"],
            3: ["take", "equip", "unequip", "drop"],
            5: ["enter", "rest"],
            7: ["configure", "create"],
        },
        abilitiesAtSkillLevel: {
            1: ["jab"],
        },
        attributesAtSkillLevel: {
            2: { con: 1 },
            4: { dex: 1 },
            6: { con: 1 },
            8: { dex: 1 },
            9: { dex: 1 },
            10: { con: 1 },
        },
    },
    // Combat skills
    dirtyfighting: {
        skillLine: "dirtyfighting",
        description: "Dirty Fighting",
        abilitiesAtSkillLevel: {
            1: ["eyePoke"],
        },
        attributesAtSkillLevel: {
            2: { dex: 1 },
            4: { str: 1 },
            6: { dex: 1 },
            8: { str: 1 },
            9: { dex: 1 },
            10: { str: 1 },
        },
    },
    // Monster skills
    beast: {
        skillLine: "beast",
        description: "Beast",
        abilitiesAtSkillLevel: {
            1: ["scratch"],
        },
        attributesAtSkillLevel: {
            2: { str: 1, con: 1, dex: 1 },
            4: { str: 1, con: 1, dex: 1 },
            6: { str: 1, con: 1, dex: 1 },
            8: { str: 1, con: 1, dex: 1 },
            10: { str: 1, con: 1, dex: 1 },
        },
    },
    arachnid: {
        skillLine: "arachnid",
        description: "Arachnid",
        abilitiesAtSkillLevel: {
            1: ["bite"],
            3: ["paralyze"],
        },
        attributesAtSkillLevel: {
            2: { str: 1, con: 1, dex: 1 },
            4: { str: 1, con: 1, dex: 1 },
            6: { str: 1, con: 1, dex: 1 },
            8: { str: 1, con: 1, dex: 1 },
            10: { str: 1, con: 1, dex: 1 },
        },
    },
    draconic: {
        skillLine: "draconic",
        description: "Draconic",
        abilitiesAtSkillLevel: {
            1: ["bite"],
            3: ["paralyze"],
            5: ["doubleSlash"],
            8: ["breathFire"],
        },
        attributesAtSkillLevel: {
            2: { str: 2, con: 2, dex: 2, fth: 2, int: 2 },
            4: { str: 2, con: 2, dex: 2, fth: 2, int: 2 },
            6: { str: 2, con: 2, dex: 2, fth: 2, int: 2 },
            8: { str: 2, con: 2, dex: 2, fth: 2, int: 2 },
            10: { str: 2, con: 2, dex: 2, fth: 2, int: 2 },
        },
    },
};
