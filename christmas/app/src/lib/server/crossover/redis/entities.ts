import { Schema, type Entity } from "redis-om";

export {
    MonsterEntitySchema,
    PlayerEntitySchema,
    type Monster,
    type MonsterEntity,
    type Player,
    type PlayerEntity,
};

// Combines both `PlayerState` and `PlayerMetadata`
const PlayerEntitySchema = new Schema("Player", {
    // Player metadata
    player: { type: "string" },
    name: { type: "string" },
    description: { type: "string" },
    // Player state
    geohash: { type: "string" },
    loggedIn: { type: "boolean" },
});

interface Player {
    // Player metadata
    player: string;
    name: string;
    description: string;
    // Player state
    geohash: string;
    loggedIn: boolean;
}

type PlayerEntity = Player & Entity;

const MonsterEntitySchema = new Schema("Monster", {
    // Monster metadata
    monster: { type: "string" },
    name: { type: "string" },
    type: { type: "string" },
    // Monster state
    geohash: { type: "string" },
    health: { type: "number" },
});

interface Monster {
    // Monster metadata
    monster: string;
    name: string;
    type: string;
    // Monster state
    geohash: string;
    health: number;
}

type MonsterEntity = Monster & Entity;
