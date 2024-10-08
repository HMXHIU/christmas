import type { CacheInterface } from "$lib/caches";
import {
    sampleFrom,
    seededRandomNumberBetween,
    stringToRandomNumber,
} from "$lib/utils/random";
import { childrenGeohashesAtPrecision } from "../utils";
import { elevationAtGeohash } from "./biomes";
import { topologicalAnalysis, worldSeed } from "./settings/world";
import type { GeohashLocation } from "./types";

export {
    blueprintProps,
    blueprintsAtTerritory,
    sampleChildrenGeohashesAtPrecision,
    type BluePrint,
    type BluePrints,
};

type BluePrints = "outpost" | "town";

interface BluePrint {
    template: BluePrints;
    frequency: {
        precision: number; // eg. region (how many instances of the blueprint in the region)
        instances: {
            min: number;
            max: number;
        };
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

interface BlueprintProp {
    prop: string;
    blueprint: BluePrints;
}

type BlueprintPropLocations = Record<string, BlueprintProp>;

interface TerritoryBlueprint {
    territory: string;
    locationType: GeohashLocation;
    props: BlueprintPropLocations; // location of the props to spawn
}

async function blueprintsAtTerritory(
    territory: string,
    locationType: GeohashLocation,
    blueprints: Record<BluePrints, BluePrint>,
    blueprintsToSpawn: BluePrints[], // order matters for reproducibility
    options?: {
        topologyResponseCache?: CacheInterface;
        topologyResultCache?: CacheInterface;
        topologyBufferCache?: CacheInterface;
        blueprintsAtTerritoryCache?: CacheInterface;
    },
): Promise<TerritoryBlueprint> {
    // Get from cache
    const cacheKey = `${territory}-${locationType}`;
    let territoryBlueprint: TerritoryBlueprint =
        await options?.blueprintsAtTerritoryCache?.get(cacheKey);
    if (territoryBlueprint) {
        return territoryBlueprint;
    }

    territoryBlueprint = {
        territory,
        locationType,
        props: {},
    };

    // Do not spawn blueprints on territories with little land
    const ta = (await topologicalAnalysis())[territory];
    if (!ta || ta.land < 0.2) {
        return territoryBlueprint;
    }

    const bpLocations = new Set<string>(); // keep track of chosen locations so we don't overlap
    for (const blueprint of blueprintsToSpawn.map((t) => blueprints[t])) {
        // Check locationType
        if (blueprint.locationType !== locationType) {
            continue;
        }

        // Check frequency precision (must be greater than territory)
        const { frequency, precision } = blueprint;
        if (frequency.precision <= territory.length) {
            continue;
        }

        // Get plots in which we should spawn the blueprint
        const plots = childrenGeohashesAtPrecision(
            territory,
            frequency.precision,
        );
        for (const plot of plots) {
            // Check plot on land
            const elevation = await elevationAtGeohash(plot, locationType, {
                responseCache: options?.topologyResponseCache,
                resultsCache: options?.topologyResultCache,
                bufferCache: options?.topologyBufferCache,
            });
            if (elevation < 2) {
                continue;
            }

            // Generate the number of instances of the blueprint in the plot
            let seed = stringToRandomNumber(blueprint.template + plot);
            const { min, max } = frequency.instances;
            const numInstances = seededRandomNumberBetween(min, max, seed++);

            // Generate blueprint locations
            const blueprintLocations = sampleFrom(
                childrenGeohashesAtPrecision(plot, precision).filter(
                    (geohash) => !bpLocations.has(geohash),
                ), // this makes the ordering of blueprintsToSpawn matter
                numInstances,
                seed++,
            );

            for (const location of blueprintLocations) {
                // Exclude plots not on land
                const elevation = await elevationAtGeohash(
                    location,
                    locationType,
                    {
                        responseCache: options?.topologyResponseCache,
                        resultsCache: options?.topologyResultCache,
                        bufferCache: options?.topologyBufferCache,
                    },
                );
                if (elevation < 1) {
                    continue;
                }
                const props = await blueprintProps(
                    location,
                    locationType,
                    blueprint,
                    {
                        topologyResponseCache: options?.topologyResponseCache,
                        topologyResultCache: options?.topologyResultCache,
                        topologyBufferCache: options?.topologyBufferCache,
                    },
                );
                Object.assign(territoryBlueprint.props, props);
                bpLocations.add(location);
            }
        }
    }

    // Set cache
    if (options?.blueprintsAtTerritoryCache) {
        await options.blueprintsAtTerritoryCache.set(
            cacheKey,
            territoryBlueprint,
        );
    }

    return territoryBlueprint;
}

async function blueprintProps(
    location: string, // the blueprint geohash
    locationType: GeohashLocation,
    blueprint: BluePrint,
    options?: {
        topologyResponseCache?: CacheInterface;
        topologyResultCache?: CacheInterface;
        topologyBufferCache?: CacheInterface;
    },
): Promise<BlueprintPropLocations> {
    const propLocations: BlueprintPropLocations = {};
    for (const [
        cluster,
        { props, pattern, precision, min, max },
    ] of Object.entries(blueprint.clusters)) {
        let seed = stringToRandomNumber(location + locationType + cluster);

        // Determine the location of the cluster where the prop should be spawned
        const clusterLocations = sampleChildrenGeohashesAtPrecision(
            location,
            precision,
            pattern,
            seededRandomNumberBetween(min, max, seed),
            seed,
        );

        for (const clusterLocation of clusterLocations) {
            // Exclude plots not on land
            const elevation = await elevationAtGeohash(
                clusterLocation,
                locationType,
                {
                    responseCache: options?.topologyResponseCache,
                    resultsCache: options?.topologyResultCache,
                    bufferCache: options?.topologyBufferCache,
                },
            );
            if (elevation < 1) {
                continue;
            }

            for (const [prop, { min, max, pattern }] of Object.entries(props)) {
                let propSeed = stringToRandomNumber(clusterLocation + prop);
                const propGeohashes = sampleChildrenGeohashesAtPrecision(
                    clusterLocation,
                    worldSeed.spatial.unit.precision,
                    pattern,
                    seededRandomNumberBetween(min, max, propSeed),
                    propSeed,
                );
                for (const geohash of propGeohashes) {
                    propLocations[geohash] = {
                        prop,
                        blueprint: blueprint.template,
                    };
                }
            }
        }
    }

    return propLocations;
}

function sampleChildrenGeohashesAtPrecision(
    location: string,
    precision: number,
    pattern: "random" | "center" | "peripheral",
    count: number,
    seed: number,
): string[] {
    const locations = childrenGeohashesAtPrecision(location, precision);

    switch (pattern) {
        case "random":
            return sampleFrom(locations, count, seed);
        case "center":
            const centerChars = location.length % 2 ? "dest67km" : "mtks7e6d";

            if (count > centerChars.length) {
                count = centerChars.length;
            }

            // Choose geohashes near the center
            return sampleFrom(
                locations.filter((s) => centerChars.includes(s.slice(-1))),
                count,
                seed,
            );
        case "peripheral":
            const peripheralChars =
                location.length % 2
                    ? "bcfguvyz89wx23qr0145hjnp"
                    : "prxznqwyjvhu5g4f139c028b";

            if (count > peripheralChars.length) {
                count = peripheralChars.length;
            }

            // Choose geohashes near the edges
            return sampleFrom(
                locations.filter((s) => peripheralChars.includes(s.slice(-1))),
                count,
                seed,
            );
    }
}
