import type { NPCs } from "$lib/server/crossover/npc/types";
import type { GeohashLocation } from "../types";

export type {
    BluePrint,
    BluePrints,
    DungeonBluePrint,
    DungeonBluePrints,
    LocationBlueprint,
    Stencil,
};

type BluePrints = "outpost" | "town";

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
            props: {
                [prop: string]: {
                    min: number; // number of props in a cluster
                    max: number;
                    pattern: "random" | "center" | "peripheral"; // distribution of props in the cluster
                };
            };
            min: number; // number of clusters
            max: number;
            pattern: "random" | "center" | "peripheral"; // distribution of clusters in the plot
        };
    };
}

// Todo: Add DungeonBluePrints + BluePrint, use it to spawn entrances, control points, npcs, monsters

type DungeonBluePrints = "entrance" | "control";

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
            props?: {
                [prop: string]: {
                    min: number; // number of props in a cluster
                    max: number;
                    pattern: "random" | "center" | "peripheral"; // distribution of props in the cluster
                };
            };
            npcs?: {
                [npc in NPCs]: {
                    min: number; // number of npcs in a cluster
                    max: number;
                    pattern: "random" | "center" | "peripheral"; // distribution of npcs in the cluster
                };
            };
            beasts?: {
                [beast: string]: {
                    min: number; // number of monsters in a cluster
                    max: number;
                    pattern: "random" | "center" | "peripheral"; // distribution of monsters in the cluster
                };
            };
            min: number; // number of clusters
            max: number;
            pattern: "random" | "center" | "peripheral"; // distribution of clusters in the blueprint location
        };
    };
}

interface Stencil {
    [location: string]: {
        prop?: string;
        beast?: string;
        npc?: string;
        blueprint: BluePrints | DungeonBluePrints;
    };
}

interface LocationBlueprint {
    location: string; // can be territory, dungeons, etc
    locationType: GeohashLocation;
    stencil: Stencil;
}
