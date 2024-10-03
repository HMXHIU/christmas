import { PUBLIC_MINIO_ENDPOINT } from "$env/static/public";
import type { NPCs } from "$lib/server/crossover/npc/types";
import type { SkillLines } from "./skills";
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
        avatar: `${PUBLIC_MINIO_ENDPOINT}/game/avatar/morphology/humanoid.json`, // make sure to upload to the game/avatar/morphology bucket
        animation: `${PUBLIC_MINIO_ENDPOINT}/game/avatar/morphology/humanoid_animation.json`,
    },
    canine: {
        avatar: `${PUBLIC_MINIO_ENDPOINT}/game/avatar/morphology/canine.json`,
        animation: `${PUBLIC_MINIO_ENDPOINT}/game/avatar/morphology/canine_animation.json`,
    },
};

type Alignment = "good" | "neutral" | "evil";

/**
 * `Beast` is a template used to spawn a `Monster` with derived stats from the template.
 */
interface Beast {
    beast: string;
    description: string;
    skillLines: Partial<Record<SkillLines, number>>;
    alignment: Alignment;
    asset: AssetMetadata;
    trophies: Partial<Record<NPCs, string[]>>;
}
