import type { CacheInterface } from "$lib/caches";
import {
    sampleFrom,
    seededRandomNumberBetween,
    stringToRandomNumber,
} from "$lib/utils/random";
import { childrenGeohashesAtPrecision, geohashDistance } from "../../utils";
import { elevationAtGeohash } from "../biomes";
import { generateDungeonGraph } from "../dungeons";
import { topologicalAnalysis, worldSeed } from "../settings/world";
import type { GeohashLocation } from "../types";
import type {
    BluePrint,
    BluePrints,
    DungeonBluePrint,
    DungeonBluePrints,
    LocationBlueprint,
} from "./types";
import {
    sampleChildrenGeohashesAtPrecision,
    stencilFromBlueprint,
} from "./utils";

export { blueprintsAtDungeon, blueprintsAtTerritory };

async function blueprintsAtDungeon(
    dungeon: string,
    locationType: GeohashLocation,
    blueprints: Record<DungeonBluePrints, DungeonBluePrint>,
    blueprintsToSpawn: DungeonBluePrints[], // order matters for reproducibility
    options?: {
        blueprintsAtLocationCache?: CacheInterface; // can reuse this cache for dungeons
        dungeonGraphCache?: CacheInterface; // can reuse this cache for dungeons
    },
): Promise<LocationBlueprint> {
    // Get from cache
    const cacheKey = `${dungeon}-${locationType}`;
    let dungeonBlueprint: LocationBlueprint =
        await options?.blueprintsAtLocationCache?.get(cacheKey);
    if (dungeonBlueprint) {
        return dungeonBlueprint;
    }

    dungeonBlueprint = {
        location: dungeon,
        locationType,
        stencil: {},
    };

    const usedRooms = new Set<string>(); // keep track of used rooms so we don't overlap
    for (const blueprint of blueprintsToSpawn.map((t) => blueprints[t])) {
        // Check locationType
        if (blueprint.locationType !== locationType) {
            continue;
        }

        // Get rooms and corridors in which we should spawn the blueprint
        const { rooms, corridors } = await generateDungeonGraph(
            dungeon,
            locationType,
            {
                dungeonGraphCache: options?.dungeonGraphCache,
            },
        );

        const { type, min, max } = blueprint.frequency;
        let seed = stringToRandomNumber(dungeon + blueprint.template + type);

        // TODO: Corridor

        const chosenRooms = sampleFrom(
            rooms.filter((r) => !usedRooms.has(r.room)),
            seededRandomNumberBetween(min, max, seed),
            seed,
        );
        chosenRooms.forEach((r) => usedRooms.add(r.room));

        for (const { plots, room } of chosenRooms) {
            // Sort plots by distance from the center (room is geohash at the center of the room)
            const plotsCloseToCenter = Array.from(plots).sort((g) =>
                geohashDistance(g, room),
            );

            for (const [
                cluster,
                { props, npcs, beasts, min, max, pattern },
            ] of Object.entries(blueprint.clusters)) {
                let seed = stringToRandomNumber(
                    dungeon + blueprint.template + cluster,
                );

                // Sample the plots based on the frequency and pattern
                const numClusters = seededRandomNumberBetween(min, max, seed);
                const pivot = Math.floor(plotsCloseToCenter.length / 2);
                let chosenClusters: string[] = [];
                if (pattern === "random") {
                    chosenClusters = sampleFrom(
                        plotsCloseToCenter,
                        numClusters,
                        seed,
                    );
                } else if (pattern === "center") {
                    chosenClusters = sampleFrom(
                        plotsCloseToCenter.slice(0, pivot),
                        numClusters,
                        seed,
                    );
                } else if (pattern === "peripheral") {
                    chosenClusters = sampleFrom(
                        plotsCloseToCenter.slice(pivot),
                        numClusters,
                        seed,
                    );
                }

                if (props) {
                    const usedPropLocations = new Set<string>();
                    for (const {
                        ref,
                        prop,
                        pattern,
                        min,
                        max,
                        variables,
                        overwrite,
                    } of props) {
                        // Generate stencil (prop locations)
                        for (const clusterLocation of chosenClusters) {
                            let seed = stringToRandomNumber(
                                clusterLocation + type + prop,
                            );

                            // Determine the location of the cluster where the prop should be spawned
                            const propLocations = sampleFrom(
                                childrenGeohashesAtPrecision(
                                    clusterLocation,
                                    worldSeed.spatial.unit.precision,
                                ).filter((g) => !usedPropLocations.has(g)),
                                seededRandomNumberBetween(min, max, seed),
                                seed,
                            );
                            for (const geohash of propLocations) {
                                dungeonBlueprint.stencil[geohash] = {
                                    prop,
                                    ref,
                                    variables,
                                    overwrite,
                                    blueprint: blueprint.template,
                                };
                                usedPropLocations.add(geohash);
                            }
                        }
                    }
                }

                if (beasts) {
                    for (const { beast, min, max, pattern } of beasts) {
                        // Generate stencil (beast locations)
                        for (const clusterLocation of chosenClusters) {
                            let seed = stringToRandomNumber(
                                clusterLocation + type + beast,
                            );

                            // Determine the location of the cluster where the beast should be spawned
                            const beastLocations =
                                sampleChildrenGeohashesAtPrecision(
                                    clusterLocation,
                                    worldSeed.spatial.unit.precision,
                                    pattern,
                                    seededRandomNumberBetween(min, max, seed),
                                    seed,
                                );
                            for (const geohash of beastLocations) {
                                dungeonBlueprint.stencil[geohash] = {
                                    beast,
                                    blueprint: blueprint.template,
                                };
                            }
                        }
                    }
                }

                if (npcs) {
                    for (const { npc, min, max, pattern } of npcs) {
                        // Generate stencil (npc locations)
                        for (const clusterLocation of chosenClusters) {
                            let seed = stringToRandomNumber(
                                clusterLocation + type + npc,
                            );

                            // Determine the location of the cluster where the npc should be spawned
                            const npcLocations =
                                sampleChildrenGeohashesAtPrecision(
                                    clusterLocation,
                                    worldSeed.spatial.unit.precision,
                                    pattern,
                                    seededRandomNumberBetween(min, max, seed),
                                    seed,
                                );
                            for (const geohash of npcLocations) {
                                dungeonBlueprint.stencil[geohash] = {
                                    npc,
                                    blueprint: blueprint.template,
                                };
                            }
                        }
                    }
                }
            }
        }
    }

    // Set cache
    if (options?.blueprintsAtLocationCache) {
        await options.blueprintsAtLocationCache.set(cacheKey, dungeonBlueprint);
    }

    return dungeonBlueprint;
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
        blueprintsAtLocationCache?: CacheInterface;
    },
): Promise<LocationBlueprint> {
    // Get from cache
    const cacheKey = `${territory}-${locationType}`;
    let territoryBlueprint: LocationBlueprint =
        await options?.blueprintsAtLocationCache?.get(cacheKey);
    if (territoryBlueprint) {
        return territoryBlueprint;
    }

    territoryBlueprint = {
        location: territory,
        locationType,
        stencil: {},
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
            const { min, max } = frequency;
            const numInstances = seededRandomNumberBetween(min, max, seed++);

            async function onLandPredicate(
                location: string,
                locationType: GeohashLocation,
            ): Promise<boolean> {
                return (
                    (await elevationAtGeohash(location, locationType, {
                        responseCache: options?.topologyResponseCache,
                        resultsCache: options?.topologyResultCache,
                        bufferCache: options?.topologyBufferCache,
                    })) > 1
                );
            }

            // Generate blueprint locations (on land)
            const blueprintLocations = await Promise.all(
                sampleFrom(
                    // The sampling order of blueprintsToSpawn matters
                    childrenGeohashesAtPrecision(plot, precision).filter(
                        (geohash) => !bpLocations.has(geohash),
                    ),
                    numInstances,
                    seed++,
                ).filter((g) => onLandPredicate(g, locationType)),
            );

            // Generate stencil (prop locations)
            for (const location of blueprintLocations) {
                Object.assign(
                    territoryBlueprint.stencil,
                    await stencilFromBlueprint(
                        location,
                        locationType,
                        blueprint,
                        onLandPredicate, // on land
                    ),
                );
                bpLocations.add(location);
            }
        }
    }

    // Set cache
    if (options?.blueprintsAtLocationCache) {
        await options.blueprintsAtLocationCache.set(
            cacheKey,
            territoryBlueprint,
        );
    }

    return territoryBlueprint;
}
