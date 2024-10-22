import type { NPCs } from "$lib/server/crossover/npc/types";
import { GAME_MORPHOLOGY } from "../defs";
import type { Skills } from "../types";
import type { Faction } from "./settings/affinities";
import type { AssetMetadata } from "./types";

export { avatarMorphologies, type AvatarMorphology, type Beast };

/*
 * Upload the morphology json files to the GAME_MORPHOLOGY bucket
 * Use the format based on the demographics ${race}_${gender} for the keys
 */
type AvatarMorphology = "humanoid" | "canine" | "human_male" | "human_female";
const avatarMorphologies: Record<
    AvatarMorphology,
    { avatar: string; animation: string }
> = {
    // The format is based
    human_male: {
        avatar: `${GAME_MORPHOLOGY}/humanoid.json`,
        animation: `${GAME_MORPHOLOGY}/humanoid_animation.json`,
    },
    human_female: {
        avatar: `${GAME_MORPHOLOGY}/humanoid.json`,
        animation: `${GAME_MORPHOLOGY}/humanoid_animation.json`,
    },
    humanoid: {
        avatar: `${GAME_MORPHOLOGY}/humanoid.json`,
        animation: `${GAME_MORPHOLOGY}/humanoid_animation.json`,
    },
    canine: {
        avatar: `${GAME_MORPHOLOGY}/canine.json`,
        animation: `${GAME_MORPHOLOGY}/canine_animation.json`,
    },
};

/*
 * `Beast` is a template used to spawn a `Monster` with derived stats from the template.
 */
interface Beast {
    beast: string;
    description: string;
    skills: Skills;
    faction: Faction;
    asset: AssetMetadata;
    trophies: Partial<Record<NPCs, string[]>>;
}
