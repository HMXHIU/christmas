import { Schema, type Entity } from "redis-om";

export { PlayerEntitySchema, type Player, type PlayerEntity };

// combines both `PlayerState` and `PlayerMetadata`
const PlayerEntitySchema = new Schema("Player", {
    // Player metadata
    player: { type: "string" },
    name: { type: "string" },
    description: { type: "string" },
    // Player state
    tile: { type: "string" },
    loggedIn: { type: "boolean" },
});

interface Player {
    // Player metadata
    player: string;
    name: string;
    description: string;
    // Player state
    tile: string;
    loggedIn: boolean;
}

type PlayerEntity = Player & Entity;
