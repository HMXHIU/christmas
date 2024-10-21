import type { NPCs } from "$lib/server/crossover/npc/types";
import type { ItemVariables } from "../compendium";
import type { GeohashLocation } from "../types";

export type {
    BeastCluster,
    BluePrint,
    BluePrints,
    DungeonBluePrint,
    DungeonBluePrints,
    EntityCluster,
    LocationBlueprint,
    NPCCluster,
    Pattern,
    PropCluster,
    Stencil,
};

type BluePrints = "outpost" | "town";

type Pattern = "random" | "center" | "peripheral";

type EntityCluster = BeastCluster | NPCCluster | PropCluster;

interface PropCluster {
    prop: string;
    min: number; // number of props in a cluster
    max: number;
    pattern: Pattern; // distribution of props in the cluster
    ref?: string;
    variables?: ItemVariables; // item variables to be set when spawning the item
    overwrite?: Record<string, string | boolean | number>;
    unique?: boolean;
}

interface BeastCluster {
    beast: string;
    min: number; // number of beasts in a cluster
    max: number;
    pattern: Pattern; // distribution of beasts in the cluster
    unique?: boolean;
}

interface NPCCluster {
    npc: NPCs;
    min: number; // number of npcs in a cluster
    max: number;
    pattern: Pattern; // distribution of npcs in the cluster
    unique?: boolean;
}

interface BluePrint {
    template: BluePrints;
    frequency: {
        precision: number; // eg. region (how many instances of the blueprint in the region)
        min: number;
        max: number;
    };
    locationType: GeohashLocation;
    precision: number; // size of the blueprint (eg. town)
    clusters: {
        [cluster: string]: {
            precision: number; // size of the cluster
            props?: PropCluster[];
            beasts?: BeastCluster[];
            npcs?: NPCCluster[];
            min: number; // number of clusters
            max: number;
            pattern: Pattern; // distribution of clusters in the plot
        };
    };
}

type DungeonBluePrints = "entrance" | "control" | "market" | "corridorBeasts";

interface DungeonBluePrint {
    template: DungeonBluePrints;
    locationType: GeohashLocation;
    frequency: {
        type: "room" | "corridor";
        min: number;
        max: number;
    };
    clusters: {
        [cluster: string]: {
            props?: PropCluster[];
            beasts?: BeastCluster[];
            npcs?: NPCCluster[];
            min: number; // number of clusters
            max: number;
            pattern: Pattern; // distribution of clusters in the blueprint location
        };
    };
}

interface Stencil {
    [location: string]: {
        blueprint: BluePrints | DungeonBluePrints;
        prop?: string;
        beast?: string;
        npc?: NPCs;
        ref?: string;
        variables?: ItemVariables;
        overwrite?: Record<string, string | boolean | number>;
        unique?: boolean;
    };
}

interface LocationBlueprint {
    location: string; // can be territory, dungeons, etc
    locationType: GeohashLocation;
    stencil: Stencil;
}
