import type {
    BluePrint,
    BluePrints,
    DungeonBluePrint,
    DungeonBluePrints,
} from "../blueprint/types";
import { worldSeed } from "./world";

export {
    blueprints,
    blueprintsToSpawn,
    dungeonBlueprints,
    dungeonBlueprintsToSpawn,
};

const blueprintsToSpawn: BluePrints[] = ["outpost", "town"];
const dungeonBlueprintsToSpawn: DungeonBluePrints[] = ["entrance", "control"];

const dungeonBlueprints: Record<DungeonBluePrints, DungeonBluePrint> = {
    entrance: {
        template: "entrance",
        locationType: "d1",
        frequency: {
            max: 1,
            min: 1,
            type: "room",
        },
        clusters: {
            entrance: {
                props: {
                    dungeonentrance: {
                        min: 1,
                        max: 1,
                        pattern: "center",
                    },
                },
                min: 1,
                max: 1,
                pattern: "center",
            },
        },
    },
    control: {
        template: "control",
        locationType: "d1",
        frequency: {
            max: 1,
            min: 1,
            type: "room",
        },
        clusters: {
            control: {
                props: {
                    woodendoor: {
                        // TODO: change to control point
                        min: 1,
                        max: 1,
                        pattern: "center",
                    },
                },
                min: 1,
                max: 1,
                pattern: "center",
            },
        },
    },
};

const blueprints: Record<BluePrints, BluePrint> = {
    outpost: {
        template: "outpost",
        locationType: "geohash",
        frequency: {
            precision: worldSeed.spatial.region.precision,
            min: 0,
            max: 1,
        },
        precision: worldSeed.spatial.town.precision,
        clusters: {
            market: {
                precision: worldSeed.spatial.village.precision,
                props: {
                    tavern: {
                        min: 1,
                        max: 1,
                        pattern: "random",
                    },
                },
                pattern: "random",
                min: 1,
                max: 1,
            },
        },
    },
    town: {
        template: "town",
        locationType: "geohash",
        frequency: {
            precision: worldSeed.spatial.region.precision,
            min: 0,
            max: 1,
        },
        precision: worldSeed.spatial.town.precision,
        clusters: {
            market: {
                precision: worldSeed.spatial.village.precision,
                props: {
                    tavern: {
                        min: 1,
                        max: 1,
                        pattern: "random",
                    },
                },
                pattern: "random",
                min: 1,
                max: 1,
            },
        },
    },
};
