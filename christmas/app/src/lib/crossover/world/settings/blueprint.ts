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
    "corridorBeasts",
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
                        prop: "control",
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
    corridorBeasts: {
        template: "corridorBeasts",
        locationType: "d1",
        frequency: {
            max: 5,
            min: 3,
            type: "corridor",
        },
        clusters: {
            goblins: {
                beasts: [
                    {
                        beast: "goblin",
                        min: 1,
                        max: 3,
                        pattern: "random",
                        unique: true,
                    },
                ],
                min: 2,
                max: 5,
                pattern: "random",
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
        // This means every `region` has x number of this blueprint (a `town` will be selected from of the the 32 towns in the `region`)
        frequency: {
            precision: worldSeed.spatial.region.precision,
            min: 0,
            max: 1,
        },
        // This is the spatial size of one instance of the blueprint
        precision: worldSeed.spatial.town.precision,
        clusters: {
            control: {
                // This is the spatial size of 1 cluster inside the instance
                precision: worldSeed.spatial.village.precision,
                props: {
                    control: {
                        min: 1,
                        max: 1,
                        pattern: "center",
                    },
                },
                pattern: "random",
                min: 1,
                max: 1,
            },
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
            control: {
                precision: worldSeed.spatial.village.precision,
                props: {
                    control: {
                        min: 1,
                        max: 1,
                        pattern: "center",
                    },
                },
                pattern: "random",
                min: 1,
                max: 1,
            },
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
