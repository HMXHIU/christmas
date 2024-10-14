import type { NPCs } from "$lib/server/crossover/npc/types";
import { GAME_MORPHOLOGY } from "../defs";
import type { Skills } from "../types";
import type { AssetMetadata } from "./types";

export {
    avatarMorphologies,
    type Alignment,
    type AvatarMorphology,
    type Beast,
};

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

type Alignment = "good" | "neutral" | "evil";

/**
 * `Beast` is a template used to spawn a `Monster` with derived stats from the template.
 */
interface Beast {
    beast: string;
    description: string;
    skills: Skills;
    alignment: Alignment;
    asset: AssetMetadata;
    trophies: Partial<Record<NPCs, string[]>>;
}
