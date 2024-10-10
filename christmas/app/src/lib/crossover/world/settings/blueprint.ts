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
const dungeonBlueprintsToSpawn: DungeonBluePrints[] = [
    "entrance",
    "control",
    "market",
];

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
                props: [
                    {
                        ref: "entrance",
                        prop: "dungeonentrance",
                        min: 1,
                        max: 1,
                        pattern: "center",
                        variables: {
                            target: "${exit.item}",
                        },
                        overwrite: {
                            locT: "geohash", // entrance is at ground level
                        },
                        unique: true,
                    },
                    {
                        ref: "exit",
                        prop: "dungeonentrance",
                        min: 1,
                        max: 1,
                        pattern: "center",
                        variables: {
                            target: "${entrance.item}",
                        },
                        unique: true,
                    },
                ],
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
                props: [
                    {
                        prop: "woodendoor", // TODO: change to control point
                        min: 1,
                        max: 1,
                        pattern: "center",
                        unique: true,
                    },
                ],
                min: 1,
                max: 1,
                pattern: "center",
            },
        },
    },
    market: {
        template: "market",
        locationType: "d1",
        frequency: {
            max: 1,
            min: 1,
            type: "room",
        },
        clusters: {
            innkeeper: {
                npcs: [
                    {
                        npc: "innkeeper",
                        min: 1,
                        max: 1,
                        pattern: "random",
                        unique: true,
                    },
                ],
                min: 1,
                max: 1,
                pattern: "peripheral",
            },
            blacksmith: {
                npcs: [
                    {
                        npc: "blacksmith",
                        min: 1,
                        max: 1,
                        pattern: "random",
                        unique: true,
                    },
                ],
                min: 1,
                max: 1,
                pattern: "peripheral",
            },
            grocer: {
                npcs: [
                    {
                        npc: "grocer",
                        min: 1,
                        max: 1,
                        pattern: "random",
                        unique: true,
                    },
                ],
                min: 1,
                max: 1,
                pattern: "peripheral",
            },
            alchemist: {
                npcs: [
                    {
                        npc: "alchemist",
                        min: 1,
                        max: 1,
                        pattern: "random",
                        unique: true,
                    },
                ],
                min: 1,
                max: 1,
                pattern: "peripheral",
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
