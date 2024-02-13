import { Schema, type Entity } from "redis-om";
import { Repository } from "redis-om";

export { PlayerSchema, type PlayerEntity };

// Should be a superset or PlayerMetadata (see anchor-client/types.ts)
const PlayerSchema = new Schema("Player", {
    player: { type: "string" },
    name: { type: "string" },
    tile: { type: "string" },
    loggedIn: { type: "boolean" },
});
interface PlayerEntity extends Entity {
    player: string;
    name: string;
    tile: string;
    loggedIn: boolean;
}
