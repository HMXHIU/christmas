import type { BluePrint, BluePrints } from "../blueprint";
import { worldSeed } from "./world";

export { blueprintOrder, blueprints };

const blueprintOrder: BluePrints[] = ["outpost", "town"];

const blueprints: Record<BluePrints, BluePrint> = {
    outpost: {
        template: "outpost",
        locationType: "geohash",
        frequency: {
            precision: worldSeed.spatial.region.precision,
            instances: {
                min: 0,
                max: 1,
            },
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
            instances: {
                min: 0,
                max: 1,
            },
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
