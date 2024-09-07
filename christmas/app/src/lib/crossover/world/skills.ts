import type { Abilities } from "./abilities";

export { type SkillLine, type SkillLines };

type SkillLines = "exploration" | "firstaid" | "dirtyfighting";

interface SkillLine {
    skillLine: SkillLines;
    description: string;
    abilitiesAtSkillLevel: Record<number, Abilities>;
}
