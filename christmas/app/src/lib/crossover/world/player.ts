import type { AssetMetadata } from ".";
import { worldSeed } from "./settings";

export { MAX_POSSIBLE_AP, playerAsset, playerStats };

const MAX_POSSIBLE_AP = 8;

function playerStats({ level }: { level: number }): {
    hp: number;
    mp: number;
    st: number;
    ap: number;
} {
    return {
        hp: level * 10,
        mp: level * 10,
        st: level * 10,
        ap: Math.min(4 + Math.floor(level / 10), MAX_POSSIBLE_AP),
    };
}

const playerAsset: AssetMetadata = {
    bundle: "player",
    name: "player",
    animations: {
        stand: "stand",
    },
    variants: {
        default: "stand/0",
    },
    width: 1,
    height: 1,
    precision: worldSeed.spatial.unit.precision,
};
