import type { NPC, NPCs } from "../npc";
import type { Dialogue, Dialogues } from "../redis/entities";

export { dialogues, npcs };

const npcs: Record<NPCs, NPC> = {
    innkeep: {
        npc: "innkeep",
        nameTemplate: "Inn Keeper",
        descriptionTemplate:
            "The innkeeper tends to the inn with efficiency, offering food, drink, and a place to rest for travelers. Always attentive to guests, they know much about the town and its visitors",
        asset: {
            path: "",
        },
    },
    grocer: {
        npc: "grocer",
        nameTemplate: "Grocer",
        descriptionTemplate:
            "The grocer diligently organizes shelves and manages the shop with care. Always ready to assist customers, they have a keen knowledge of local produce and supplies, offering fair deals to all who pass through",
        asset: {
            path: "",
        },
    },
    blacksmith: {
        npc: "blacksmith",
        nameTemplate: "Blacksmith",
        descriptionTemplate:
            "The blacksmith works steadily at the forge, crafting and repairing weapons and tools with precision. Known for their skill and reliability, they provide essential services to adventurers and townsfolk alike",
        asset: {
            path: "",
        },
    },
    alchemist: {
        npc: "alchemist",
        nameTemplate: "Alchemist",
        descriptionTemplate:
            "The alchemist carefully mixes potions and brews, always experimenting with new concoctions. Knowledgeable in herbs and mystical ingredients, they offer remedies and rare elixirs to those seeking both healing and power.",
        asset: {
            path: "",
        },
    },
};

const greetings: Dialogue[] = [
    // general
    {
        dia: "grt",
        msg: "${name} greets you, 'Well met kin, you may *rest* here ${timeOfDay}'",
    },
];

const ignores: Dialogue[] = [
    // general
    {
        dia: "ign",
        msg: "${name} ignores you",
    },
    // innkeep
    {
        dia: "ign",
        npc: "innkeep",
        msg: "${name} ignores you, 'Get lost, we don't deal with your types around here!'.",
    },
];

// These dialogues will be indexed into redis to be searchable
const dialogues: Record<Dialogues, Dialogue[]> = {
    grt: greetings,
    ign: ignores,
};
