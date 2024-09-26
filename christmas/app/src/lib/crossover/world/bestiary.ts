import { PUBLIC_HOST } from "$env/static/public";
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
        avatar: `${PUBLIC_HOST}/avatar/humanoid.json`,
        animation: `${PUBLIC_HOST}/avatar/humanoid_animation.json`,
    },
    canine: {
        avatar: `${PUBLIC_HOST}/avatar/canine.json`,
        animation: `${PUBLIC_HOST}/avatar/canine.json`,
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
