import type { SkillLine, SkillLines } from "../skills";

export { skillLines };

const skillLines: Record<SkillLines, SkillLine> = {
    // General skills
    firstaid: {
        skillLine: "firstaid",
        description: "First Aid",
        currency: ["lum", "umb"],
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
        learningDialogues: {
            2: [
                "${teacher.name} begins to teache you the basics rendering first aid.",
                "You follow in his steps as he bandages your hand.",
                "You feel confident that you would be able to bandage a wound in the coming days.",
                "${teacher.name} pats you on your back, 'Your lesson is done ${player.name}'",
            ],
            6: [
                "${teacher.name} hands you a small pouch filled with herbs and ointments.",
                "'Today, we'll learn about treating more severe injuries,' ${teacher.name} explains.",
                "You practice creating poultices and setting splints on a training dummy.",
                "The knowledge settles in your mind, empowering you to handle tougher situations.",
                "'Remember, ${player.name}, quick action can save a life,' ${teacher.name} says proudly.",
            ],
            8: [
                "A group of injured adventurers stumbles into the training area.",
                "${teacher.name} nods at you, 'It's time to put your skills to the test, ${player.name}.'",
                "You work alongside ${teacher.name}, treating burns, cuts, and a nasty poison.",
                "The rush of adrenaline fades, leaving you with a profound sense of accomplishment.",
                "'Well done, ${player.name}. You're becoming a true healer,' ${teacher.name} beams.",
            ],
            10: [
                "${teacher.name} leads you to a secluded glade filled with rare medicinal plants.",
                "'The final lesson is about life itself, ${player.name},' ${teacher.name} says solemnly.",
                "You learn to channel healing energy, feeling the life force flow through your hands.",
                "A dying bird flutters nearby. With your new knowledge, you restore it to health.",
                "As the bird soars away, ${teacher.name} smiles, 'You're ready to face any challenge now.'",
            ],
        },
    },
    exploration: {
        skillLine: "exploration",
        description: "Exploration",
        currency: ["lum", "umb"],
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
        learningDialogues: {
            2: [
                "${teacher.name} hands you a worn map and a compass.",
                "'The world is vast and full of wonders, ${player.name},' ${teacher.name} says with a glint in their eye.",
                "You learn to read the map and orient yourself using the compass.",
                "A sense of excitement builds as you realize how much there is to discover.",
                "'Remember, the journey is as important as the destination,' ${teacher.name} advises.",
            ],
            6: [
                "${teacher.name} leads you to the edge of a dense forest.",
                "'Today, we'll learn to navigate nature's obstacles,' ${teacher.name} explains.",
                "You practice identifying edible plants, finding water sources, and building shelters.",
                "The forest no longer seems intimidating, but full of resources and opportunities.",
                "'You're becoming one with the wild, ${player.name},' ${teacher.name} nods approvingly.",
            ],
            8: [
                "You find yourself at the entrance of a mysterious cave with ${teacher.name}.",
                "'Underground exploration requires all your senses, ${player.name},' ${teacher.name} warns.",
                "In the darkness, you learn to navigate by touch and sound, discovering hidden passages.",
                "As you emerge, blinking in the sunlight, you feel a newfound confidence in your abilities.",
                "'The unknown is your playground now, ${player.name},' ${teacher.name} says proudly.",
            ],
            10: [
                "${teacher.name} takes you to a shimmering portal pulsing with arcane energy.",
                "'Your final lesson is about exploring the impossible, ${player.name},' ${teacher.name} says excitedly.",
                "You step through the portal, experiencing different planes of existence.",
                "Reality bends around you, but your training keeps you grounded and observant.",
                "Returning, ${teacher.name} grins, 'The world is yours to explore, brave adventurer.'",
            ],
        },
    },
    // Combat skills
    dirtyfighting: {
        skillLine: "dirtyfighting",
        description: "Dirty Fighting",
        currency: ["lum", "umb"],
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
        learningDialogues: {
            2: [],
            6: [],
            8: [],
            10: [],
        },
    },
    // Monster skills
    beast: {
        skillLine: "beast",
        description: "Beast",
        currency: ["lum", "umb"],
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
        currency: ["lum", "umb"],
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
        currency: ["lum", "umb"],
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
