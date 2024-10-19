import { Schema } from "redis-om";

export {
    DialogueSchema,
    ItemEntitySchema,
    MonsterEntitySchema,
    PlayerEntitySchema,
    QuestSchema,
    WorldEntitySchema,
};

// Only need to include searchable fields for redis schema
const PlayerEntitySchema = new Schema("Player", {
    // Player
    player: { type: "string" },
    name: { type: "string" },
    rgn: { type: "string" }, // region
    lgn: { type: "boolean" }, // logged in

    // Character
    arch: { type: "string" }, // archetype
    gen: { type: "string" }, // gender
    race: { type: "string" }, // race
    fac: { type: "string" }, // faction

    // Location
    loc: { type: "string[]" },
    locT: { type: "string" },
    locI: { type: "string" },

    // NPC
    npc: { type: "string" }, // npc instance id
});

// Only need to include searchable fields for redis schema
const MonsterEntitySchema = new Schema("Monster", {
    // Monster
    monster: { type: "string" },
    name: { type: "string" },
    beast: { type: "string" },

    // Location
    loc: { type: "string[]" },
    locT: { type: "string" },
    locI: { type: "string" },
});

// Only need to include searchable fields for redis schema
const ItemEntitySchema = new Schema("Item", {
    // Item
    item: { type: "string" },
    name: { type: "string" },
    prop: { type: "string" },
    own: { type: "string" }, // who owns or can use the item (player | monster | public (empty) | dm)
    cfg: { type: "string" }, // who can configure the item (player | monster | public (empty) | dm)
    cld: { type: "boolean" }, // collider

    // Location
    loc: { type: "string[]" },
    locT: { type: "string" },
    locI: { type: "string" },
});

const WorldEntitySchema = new Schema("World", {
    world: { type: "string" },
    url: { type: "string" },
    locT: { type: "string" },
    loc: { type: "string[]" }, // geohashes of plots (whole grids less than unit precision)
});

const DialogueSchema = new Schema("Dialogue", {
    msg: { type: "string" },
    dia: { type: "string" },
    tgt: { type: "string" },
    // Tags
    mst: { type: "string[]" },
    or: { type: "string[]" },
    exc: { type: "string[]" },
});

const QuestSchema = new Schema("Quest", {
    quest: { type: "string" },
    template: { type: "string" },
    entityIds: { type: "string[]" },
    fulfilled: { type: "boolean" },
});
