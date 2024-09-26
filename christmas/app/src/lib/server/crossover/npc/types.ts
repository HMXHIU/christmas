import type { AssetMetadata } from "$lib/crossover/world/types";

export type { NPC, NPCs };

type NPCs = "innkeeper" | "grocer" | "blacksmith" | "alchemist";

/**
 * `NPC` is a template used to create an NPC `player` instance
 */

interface NPC {
    npc: NPCs;
    nameTemplate: string;
    descriptionTemplate: string;
    asset: AssetMetadata;
}
