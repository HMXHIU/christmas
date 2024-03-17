import { Schema, type Entity } from "redis-om";

export {
    MonsterEntitySchema,
    PlayerEntitySchema,
    type Monster,
    type MonsterEntity,
    type Player,
    type PlayerEntity,
};

/*
 * Player
 */

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

/*
 * Monster
 *
 * A monster is the actual instance spawned using a `Beast` template in the bestiary.
 */

const MonsterEntitySchema = new Schema("Monster", {
    // Monster metadata
    monster: { type: "string" },
    name: { type: "string" },
    beast: { type: "string" },
    // Monster state
    geohash: { type: "string" },
    health: { type: "number" },
});

interface Monster {
    // Monster metadata
    monster: string; // unique instance id
    name: string;
    beast: string;
    // Monster state
    geohash: string;
    health: number;
}

type MonsterEntity = Monster & Entity;
