import type { WorldSeed } from "../world";

export { worldSeed, type WorldSeed };

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
        guild: {
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
        maxMonstersPerContinent: 10000000000, // 10 billion
    },
    time: {
        dayLengthHours: 24,
        yearLengthDays: 365,
        seasonLengthDays: 91,
    },
    seeds: {
        continent: {
            b: {
                bio: 0.5,
                hostile: 0.2,
                water: 0.1,
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            c: {
                bio: 0.5,
                hostile: 0.2,
                water: 0.1,
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            f: {
                bio: 0.5,
                hostile: 0.2,
                water: 0.1,
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            g: {
                bio: 0.5,
                hostile: 0.2,
                water: 0.1,
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            u: {
                bio: 0.5,
                hostile: 0.2,
                water: 0.1,
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            v: {
                bio: 0.5,
                hostile: 0.2,
                water: 0.1,
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            y: {
                bio: 0.5,
                hostile: 0.2,
                water: 0.1,
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            z: {
                bio: 0.5,
                hostile: 0.2,
                water: 0.1,
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            "8": {
                bio: 0.5,
                hostile: 0.2,
                water: 0.1,
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            "9": {
                bio: 0.5,
                hostile: 0.2,
                water: 0.1,
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            d: {
                bio: 0.5,
                hostile: 0.2,
                water: 0.1,
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            e: {
                bio: 0.5,
                hostile: 0.2,
                water: 0.1,
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            s: {
                bio: 0.5,
                hostile: 0.2,
                water: 0.1,
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            t: {
                bio: 0.5,
                hostile: 0.2,
                water: 0.1,
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            w: {
                bio: 0.5,
                hostile: 0.2,
                water: 0.0,
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            }, // no water for testing
            x: {
                bio: 0.5,
                hostile: 0.2,
                water: 0.1,
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            "2": {
                bio: 0.5,
                hostile: 0.2,
                water: 0.1,
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            "3": {
                bio: 0.5,
                hostile: 0.2,
                water: 0.1,
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            "6": {
                bio: 0.5,
                hostile: 0.2,
                water: 0.1,
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            "7": {
                bio: 0.5,
                hostile: 0.2,
                water: 0.1,
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            k: {
                bio: 0.5,
                hostile: 0.2,
                water: 0.1,
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            m: {
                bio: 0.5,
                hostile: 0.2,
                water: 0.1,
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            q: {
                bio: 0.5,
                hostile: 0.2,
                water: 0.1,
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            r: {
                bio: 0.5,
                hostile: 0.2,
                water: 0.1,
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            "0": {
                bio: 0.5,
                hostile: 0.2,
                water: 0.1,
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            "1": {
                bio: 0.5,
                hostile: 0.2,
                water: 0.1,
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            "4": {
                bio: 0.5,
                hostile: 0.2,
                water: 0.1,
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            "5": {
                bio: 0.5,
                hostile: 0.2,
                water: 0.1,
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            h: {
                bio: 0.5,
                hostile: 0.2,
                water: 0.1,
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            j: {
                bio: 0.5,
                hostile: 0.2,
                water: 0.1,
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            n: {
                bio: 0.5,
                hostile: 0.2,
                water: 0.1,
                weather: {
                    baseTemperature: 25,
                    temperatureVariation: 10,
                    rainProbability: 0.2,
                    stormProbability: 0.05,
                },
            },
            p: {
                bio: 0.5,
                hostile: 0.2,
                water: 0.1,
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
