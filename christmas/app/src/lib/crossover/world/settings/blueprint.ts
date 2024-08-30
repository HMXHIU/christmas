import type { BluePrint, Templates } from "../blueprint";
import { worldSeed } from "./world";

export { blueprintOrder, blueprints };

const blueprintOrder: Templates[] = ["outpost", "town"];

const blueprints: Record<Templates, BluePrint> = {
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
        plotPrecision: worldSeed.spatial.town.precision,
        clusters: {
            market: {
                props: {
                    tavern: {
                        instances: { min: 1, max: 1 },
                    },
                },
                pattern: "random",
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
        plotPrecision: worldSeed.spatial.town.precision,
        clusters: {
            market: {
                props: {
                    tavern: {
                        instances: { min: 1, max: 1 },
                    },
                },
                pattern: "random",
            },
        },
    },
};
