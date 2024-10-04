import type { CacheInterface } from "$lib/caches";
import { sampleFrom, seededRandom, stringToRandomNumber } from "$lib/utils";
import { childrenGeohashesAtPrecision } from "../utils";
import { elevationAtGeohash } from "./biomes";
import { topologicalAnalysis, worldSeed } from "./settings/world";
import type { GeohashLocation } from "./types";

export {
    blueprintsAtTerritory,
    generateProps,
    sampleChildrenGeohashesAtPrecision,
    type BluePrint,
    type Templates,
};

type Templates = "outpost" | "town";

interface BluePrint {
    template: Templates;
    frequency: {
        precision: number; // eg. region (how many instances of the blueprint in the region)
        instances: {
            min: number;
            max: number;
        };
    };
    locationType: GeohashLocation;
    plotPrecision: number; // eg. town (the actual size of the blueprint)
    clusters: {
        [cluster: string]: {
            props: {
                [prop: string]: {
                    instances: {
                        min: number;
                        max: number;
                    };
                };
            };
            pattern: "random" | "center" | "peripheral";
        };
    };
}

interface BlueprintProp {
    prop: string;
    blueprint: Templates;
}

type BlueprintPropLocations = Record<string, BlueprintProp>;

interface TerritoryBlueprint {
    territory: string;
    locationType: GeohashLocation;
    props: BlueprintPropLocations;
}

async function blueprintsAtTerritory(
    territory: string, // 2 precision geohash
    locationType: GeohashLocation,
    blueprints: Record<Templates, BluePrint>,
    blueprintOrder: Templates[], // for reproducibility
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

    const blueprintLocations = new Set<string>();

    for (const blueprint of blueprintOrder.map((t) => blueprints[t])) {
        // Check locationType
        if (blueprint.locationType !== locationType) {
            continue;
        }

        const { frequency, plotPrecision } = blueprint;

        if (frequency.precision <= territory.length) {
            console.warn(
                `blueprint.frequency.precision must be greater than territory`,
            );
            continue;
        }

        // Get plots in which we should spawn the blueprint
        const plots = childrenGeohashesAtPrecision(
            territory,
            frequency.precision,
        );

        for (const plot of plots) {
            // Exclude plots not on land
            const elevation = await elevationAtGeohash(plot, locationType, {
                responseCache: options?.topologyResponseCache,
                resultsCache: options?.topologyResultCache,
                bufferCache: options?.topologyBufferCache,
            });
            if (elevation < 2) {
                continue;
            }

            const seed = stringToRandomNumber(plot);
            const rv = seededRandom(seed);

            // Generate the number of instances of the blueprint in the plot
            const numInstances = Math.floor(
                rv * (frequency.instances.max - frequency.instances.min + 1) +
                    frequency.instances.min,
            );

            // Generate possible blueprint locations (sort for reproducibility)
            const availableLocations = childrenGeohashesAtPrecision(
                plot,
                plotPrecision,
            ).filter((geohash) => !blueprintLocations.has(geohash));

            // Select numInstances locations
            const chosenLocations = sampleFrom(
                availableLocations,
                numInstances,
                seed,
            );

            for (const location of chosenLocations) {
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

                const props = await generateProps(
                    location,
                    locationType,
                    blueprint,
                    seed,
                    {
                        topologyResponseCache: options?.topologyResponseCache,
                        topologyResultCache: options?.topologyResultCache,
                        topologyBufferCache: options?.topologyBufferCache,
                    },
                );
                Object.assign(territoryBlueprint.props, props);
                blueprintLocations.add(location);
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

async function generateProps(
    location: string,
    locationType: GeohashLocation,
    blueprint: BluePrint,
    seed: number,
    options?: {
        topologyResponseCache?: CacheInterface;
        topologyResultCache?: CacheInterface;
        topologyBufferCache?: CacheInterface;
    },
): Promise<BlueprintPropLocations> {
    const propLocations: BlueprintPropLocations = {};
    const locationPrecision = location.length;
    const clusterPrecision = locationPrecision + 1; // 1/32

    for (const [cluster, { props, pattern }] of Object.entries(
        blueprint.clusters,
    )) {
        // Determine the location of the cluster where the prop should be spawned
        const clusterLocation = sampleChildrenGeohashesAtPrecision(
            location,
            clusterPrecision,
            pattern,
            1,
            seed++,
        )[0];

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

        for (const [prop, { instances }] of Object.entries(props)) {
            // Determine number of instances of prop in the clusterLocation
            const propInstances = Math.floor(
                seededRandom(seed++) * (instances.max - instances.min + 1) +
                    instances.min,
            );

            const locations = sampleFrom(
                childrenGeohashesAtPrecision(
                    clusterLocation,
                    worldSeed.spatial.unit.precision,
                ),
                propInstances,
                seed++,
            );

            for (const geohash of locations) {
                propLocations[geohash] = {
                    prop,
                    blueprint: blueprint.template,
                };
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
