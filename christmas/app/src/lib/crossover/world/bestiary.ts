import { type AssetMetadata } from ".";
import { type AbilityType } from "./abilities";
import { bestiary } from "./settings";
export { monsterStats, type Beast };

/**
 * `Beast` is a template used to spawn a `Monster` with derived stats from the template.
 */
interface Beast {
    beast: string;
    description: string;
    attack: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
    defense: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
    health: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
    magic: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
    endurance: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
    speed: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
    rarity: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
    abilities: Record<AbilityType, string[]>;
    behaviours: string[];
    spawnRate: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
    spawnBiomes: string[];
    spawnHostileThreshold: number;
    asset: AssetMetadata;
}

function monsterStats({ level, beast }: { level: number; beast: string }): {
    hp: number;
    mp: number;
    st: number;
    ap: number;
} {
    const beastTemplate = bestiary[beast];
    const multiplier = 1 + Math.log(level) + level; // make monsters stronger than players
    return {
        hp: Math.ceil(beastTemplate.health * 10 * multiplier),
        mp: Math.ceil(beastTemplate.magic * 10 * multiplier),
        st: Math.ceil(beastTemplate.endurance * 10 * multiplier),
        ap: Math.ceil(beastTemplate.speed + 10),
    };
}
