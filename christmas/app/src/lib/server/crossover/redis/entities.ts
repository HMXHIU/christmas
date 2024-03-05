import { Schema, type Entity } from "redis-om";

export { PlayerEntitySchema, type Player, type PlayerEntity };

const PlayerEntitySchema = new Schema("Player", {
    player: { type: "string" },
    name: { type: "string" },
    description: { type: "string" },
    tile: { type: "string" },
    loggedIn: { type: "boolean" },
});

interface Player {
    player: string;
    name: string;
    description: string;
    tile: string;
    loggedIn: boolean;
}

type PlayerEntity = Player & Entity;
