import type { NPCs } from "$lib/server/crossover/npc/types";
import { GAME_MORPHOLOGY } from "../defs";
import type { Skills } from "../types";
import type { Faction } from "./settings/affinities";
import type { AssetMetadata } from "./types";

export { avatarMorphologies, type AvatarMorphology, type Beast };

type AvatarMorphology = "humanoid" | "canine";
const avatarMorphologies: Record<
    AvatarMorphology,
    { avatar: string; animation: string }
> = {
    humanoid: {
        avatar: `${GAME_MORPHOLOGY}/humanoid.json`, // make sure to upload to the game/avatar/morphology bucket
        animation: `${GAME_MORPHOLOGY}/humanoid_animation.json`,
    },
    canine: {
        avatar: `${GAME_MORPHOLOGY}/canine.json`,
        animation: `${GAME_MORPHOLOGY}/canine_animation.json`,
    },
};

/**
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
