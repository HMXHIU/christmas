import type { EntityType } from "$lib/crossover/types";

export type { EntityLink };

interface EntityLink {
    entityId: string;
    entityType: EntityType;
}
