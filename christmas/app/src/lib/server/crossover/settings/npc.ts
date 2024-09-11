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
        msg: "${self.name} greets you, 'Well met ${player.name}.'.",
        tgt: "${player.player}",
    },
    // innkeep
    {
        dia: "grt",
        mst: ["npc=innkeep"],
        msg: "${self.name} greets you, 'Well met ${player.name}, you may *rest* here'.",
        tgt: "${player.player}",
    },
];

const ignores: Dialogue[] = [
    // general
    {
        dia: "ign",
        msg: "${self.name} ignores you",
        tgt: "${player.player}",
    },
    // innkeep
    {
        dia: "ign",
        mst: ["npc=innkeep"],
        msg: "${self.name} ignores you, 'Get lost, we don't deal with your types around here!'.",
        tgt: "${player.player}",
    },
];

const agros: Dialogue[] = [
    // general
    {
        dia: "agro",
        msg: "${self.name} looks at you menacingly, 'You've picked the wrong fight, my friend!'.",
        tgt: "",
    },
    // innkeep
    {
        dia: "agro",
        or: ["npc=innkeep"],
        msg: "${self.name} yelps, 'Are you out of your mind ${player.name}? You can't just start a brawl in my inn!'.",
        tgt: "",
    },
    // traders
    {
        dia: "agro",
        or: ["npc=blacksmith", "npc=grocer", "npc=alchemist"],
        msg: "${self.name} cries out in desperation, 'Guards!, we have a thief over here!'.",
        tgt: "",
    },
];

// These dialogues will be indexed into redis to be searchable
const dialogues: Record<Dialogues, Dialogue[]> = {
    grt: greetings,
    ign: ignores,
    agro: agros,
};
