import { GAME_SANCTUARIES, GAME_TOPOLOGY } from "$lib/crossover/defs";
import type { Sanctuary, Spatial, WorldSeed } from "../world";

export {
    fetchSanctuaries,
    spatialAtPrecision,
    topologicalAnalysis,
    worldSeed,
    type TopologicalAnalysis,
    type WorldSeed,
};

interface TopologicalAnalysis {
    water: number;
    land: number;
    elevation: {
        mean: number;
        iqr: number;
    };
}

const _topologicalAnalysis: Record<string, TopologicalAnalysis> | undefined =
    undefined;
const sanctuaries: Sanctuary[] | undefined = undefined;

async function topologicalAnalysis(): Promise<
    Record<string, TopologicalAnalysis>
> {
    if (_topologicalAnalysis) {
        return _topologicalAnalysis;
    }
    return await (
        await fetch(`${GAME_TOPOLOGY}/topological_analysis.json`)
    ).json();
}

async function fetchSanctuaries(): Promise<Sanctuary[]> {
    if (sanctuaries) {
        return sanctuaries;
    }
    return await (await fetch(`${GAME_SANCTUARIES}/sanctuaries.json`)).json();
}

function spatialAtPrecision(p: number): Spatial | null {
    for (const [s, { precision }] of Object.entries(worldSeed.spatial)) {
        if (precision === p) {
            return s as Spatial;
        }
    }
    return null;
}

/**
 * `worldSeed` is a template used to generate a `World` instance.
 */
const worldSeed: WorldSeed = {
    name: "yggdrasil 01",
    description: "The beginning",
    spatial: {
        continent: {
            precision: 1, // geohash precision
        },
        territory: {
            precision: 2,
        },
        region: {
            precision: 3,
        },
        city: {
            precision: 4,
        },
        town: {
            precision: 5,
        },
        village: {
            precision: 6,
        },
        house: {
            precision: 7,
        },
        unit: {
            precision: 8,
        },
    },
    constants: {
        monsterLimit: {
            continent: Math.floor((2 * 32 ** 6) / 6 ** 6),
            territory: Math.floor((2 * 32 ** 5) / 6 ** 5),
            region: Math.floor((2 * 32 ** 4) / 6 ** 4),
            city: Math.floor((2 * 32 ** 3) / 6 ** 3),
            town: Math.floor((2 * 32 ** 2) / 6 ** 2),
            village: Math.floor((2 * 32) / 6),
            house: 2,
        },
    },
    /**
     * Game time proceeds faster than actual time (so player's can experience day/night cycles)
     * 8x faster than real world (in a 3 hr playtime, player will experience 1 day/night cycle)
     */
    time: {
        timeMultiplier: 8,
        hoursInADay: 24,
        daysInAYear: 365,
        daysInASeason: 91,
    },
    seeds: {
        continent: {
            b: {
                biome: {
                    forest: 0.1,
                    grassland: 0.7,
                    desert: 0.1,
                    tundra: 0.1,
                },
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            c: {
                biome: {
                    forest: 0.1,
                    grassland: 0.7,
                    desert: 0.1,
                    tundra: 0.1,
                },
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            f: {
                biome: {
                    forest: 0.1,
                    grassland: 0.7,
                    desert: 0.1,
                    tundra: 0.1,
                },
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            g: {
                biome: {
                    forest: 0.1,
                    grassland: 0.7,
                    desert: 0.1,
                    tundra: 0.1,
                },
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            u: {
                biome: {
                    forest: 0.1,
                    grassland: 0.7,
                    desert: 0.1,
                    tundra: 0.1,
                },
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            v: {
                biome: {
                    forest: 0.1,
                    grassland: 0.7,
                    desert: 0.1,
                    tundra: 0.1,
                },
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            y: {
                biome: {
                    forest: 0.1,
                    grassland: 0.7,
                    desert: 0.1,
                    tundra: 0.1,
                },
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            z: {
                biome: {
                    forest: 0.1,
                    grassland: 0.7,
                    desert: 0.1,
                    tundra: 0.1,
                },
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            "8": {
                biome: {
                    forest: 0.1,
                    grassland: 0.7,
                    desert: 0.1,
                    tundra: 0.1,
                },
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            "9": {
                biome: {
                    forest: 0.1,
                    grassland: 0.7,
                    desert: 0.1,
                    tundra: 0.1,
                },
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            d: {
                biome: {
                    forest: 0.1,
                    grassland: 0.7,
                    desert: 0.1,
                    tundra: 0.1,
                },
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            e: {
                biome: {
                    forest: 0.1,
                    grassland: 0.7,
                    desert: 0.1,
                    tundra: 0.1,
                },
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            s: {
                biome: {
                    forest: 0.1,
                    grassland: 0.7,
                    desert: 0.1,
                    tundra: 0.1,
                },
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            t: {
                biome: {
                    forest: 0.1,
                    grassland: 0.7,
                    desert: 0.1,
                    tundra: 0.1,
                },
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            w: {
                biome: {
                    forest: 0.1,
                    grassland: 0.7,
                    desert: 0.1,
                    tundra: 0.1,
                },
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            }, // no water for testing
            x: {
                biome: {
                    forest: 0.1,
                    grassland: 0.7,
                    desert: 0.1,
                    tundra: 0.1,
                },
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            "2": {
                biome: {
                    forest: 0.1,
                    grassland: 0.7,
                    desert: 0.1,
                    tundra: 0.1,
                },
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            "3": {
                biome: {
                    forest: 0.1,
                    grassland: 0.7,
                    desert: 0.1,
                    tundra: 0.1,
                },
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            "6": {
                biome: {
                    forest: 0.1,
                    grassland: 0.7,
                    desert: 0.1,
                    tundra: 0.1,
                },
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            "7": {
                biome: {
                    forest: 0.1,
                    grassland: 0.7,
                    desert: 0.1,
                    tundra: 0.1,
                },
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            k: {
                biome: {
                    forest: 0.1,
                    grassland: 0.7,
                    desert: 0.1,
                    tundra: 0.1,
                },
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            m: {
                biome: {
                    forest: 0.1,
                    grassland: 0.7,
                    desert: 0.1,
                    tundra: 0.1,
                },
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            q: {
                biome: {
                    forest: 0.1,
                    grassland: 0.7,
                    desert: 0.1,
                    tundra: 0.1,
                },
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            r: {
                biome: {
                    forest: 0.1,
                    grassland: 0.7,
                    desert: 0.1,
                    tundra: 0.1,
                },
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            "0": {
                biome: {
                    forest: 0.1,
                    grassland: 0.7,
                    desert: 0.1,
                    tundra: 0.1,
                },
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            "1": {
                biome: {
                    forest: 0.1,
                    grassland: 0.7,
                    desert: 0.1,
                    tundra: 0.1,
                },
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            "4": {
                biome: {
                    forest: 0.1,
                    grassland: 0.7,
                    desert: 0.1,
                    tundra: 0.1,
                },
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            "5": {
                biome: {
                    forest: 0.1,
                    grassland: 0.7,
                    desert: 0.1,
                    tundra: 0.1,
                },
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            h: {
                biome: {
                    forest: 0.1,
                    grassland: 0.7,
                    desert: 0.1,
                    tundra: 0.1,
                },
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            j: {
                biome: {
                    forest: 0.1,
                    grassland: 0.7,
                    desert: 0.1,
                    tundra: 0.1,
                },
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            n: {
                biome: {
                    forest: 0.1,
                    grassland: 0.7,
                    desert: 0.1,
                    tundra: 0.1,
                },
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            p: {
                biome: {
                    forest: 0.1,
                    grassland: 0.7,
                    desert: 0.1,
                    tundra: 0.1,
                },
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
        },
    },
};
