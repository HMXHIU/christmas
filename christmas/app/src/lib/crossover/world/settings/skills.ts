import type { SkillLine, SkillLines } from "../skills";

export { generalLearningDialogues, skillLines };

const skillLines: Record<SkillLines, SkillLine> = {
    // General skills
    firstaid: {
        skillLine: "firstaid",
        name: "First Aid",
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
        name: "Exploration",
        description: "Exploration",
        currency: ["lum", "umb"],
        actionsAtSkillLevel: {
            1: ["look", "say", "move", "inventory", "attack"],
            3: ["take", "equip", "unequip", "drop"],
            5: ["enter", "rest"],
            7: ["configure", "create"],
        },
        abilitiesAtSkillLevel: {
            10: ["teleport"],
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
        name: "Dirty Fighting",
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
    // Monster skills (all monsters should have the `monster` skill min at level 1)
    monster: {
        skillLine: "monster",
        name: "Monster",
        description: "Monster",
        currency: ["lum", "umb"],
        actionsAtSkillLevel: {
            1: ["attack", "move", "look", "say"],
        },
        attributesAtSkillLevel: {
            2: { str: 1, con: 1, dex: 1, fth: 1, cha: 1, mnd: 1 },
            4: { str: 1, con: 1, dex: 1, fth: 1, cha: 1, mnd: 1 },
            6: { str: 1, con: 1, dex: 1, fth: 1, cha: 1, mnd: 1 },
            8: { str: 1, con: 1, dex: 1, fth: 1, cha: 1, mnd: 1 },
            10: { str: 1, con: 1, dex: 1, fth: 1, cha: 1, mnd: 1 },
        },
    },
    beast: {
        skillLine: "beast",
        name: "Beast",
        description: "Beast",
        currency: ["lum", "umb"],
        abilitiesAtSkillLevel: {
            3: ["doubleSlash"],
        },
        attributesAtSkillLevel: {
            1: { str: 1, con: 1, dex: 1 },
            3: { str: 1, con: 1, dex: 1 },
            5: { str: 1, con: 1, dex: 1 },
            7: { str: 1, con: 1, dex: 1 },
            9: { str: 1, con: 1, dex: 1 },
        },
    },
    arachnid: {
        skillLine: "arachnid",
        name: "Arachnid",
        description: "Arachnid",
        currency: ["lum", "umb"],
        abilitiesAtSkillLevel: {
            1: ["bite"],
            3: ["paralyze"],
        },
        attributesAtSkillLevel: {
            1: { cha: 1, mnd: 1, dex: 1 },
            3: { cha: 1, mnd: 1, dex: 1 },
            5: { cha: 1, mnd: 1, dex: 1 },
            7: { cha: 1, mnd: 1, dex: 1 },
            9: { cha: 1, mnd: 1, dex: 1 },
        },
    },
    draconic: {
        skillLine: "draconic",
        name: "Draconic",
        description: "Draconic",
        currency: ["lum", "umb"],
        abilitiesAtSkillLevel: {
            1: ["bite"],
            3: ["paralyze"],
            5: ["doubleSlash"],
            8: ["breathFire"],
        },
        attributesAtSkillLevel: {
            1: { str: 3, con: 3, dex: 3, fth: 3, mnd: 3, cha: 3 },
            3: { str: 3, con: 3, dex: 3, fth: 3, mnd: 3, cha: 3 },
            5: { str: 3, con: 3, dex: 3, fth: 3, mnd: 3, cha: 3 },
            7: { str: 3, con: 3, dex: 3, fth: 3, mnd: 3, cha: 3 },
            9: { str: 3, con: 3, dex: 3, fth: 3, mnd: 3, cha: 3 },
        },
    },
};

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
