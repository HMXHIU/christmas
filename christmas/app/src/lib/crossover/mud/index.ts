import type { CacheInterface } from "$lib/caches";
import type {
    EntityType,
    GameEntity,
    Item,
    Monster,
    Player,
} from "$lib/server/crossover/redis/entities";
import { groupBy } from "lodash-es";
import { seededRandom, stringToRandomNumber } from "../utils";
import {
    biomeParametersAtCity,
    elevationAtGeohash,
    type Biome,
    type BiomeParameters,
    type BiomeType,
} from "../world/biomes";
import { bestiary } from "../world/settings/bestiary";
import { compendium } from "../world/settings/compendium";
import { type WorldSeed } from "../world/settings/world";
import { geohashLocationTypes, type LocationType } from "../world/types";
import type { Sanctuary } from "../world/world";

export {
    MudDescriptionGenerator,
    type Descriptor,
    type Season,
    type TimeOfDay,
};

interface Descriptor {
    name: string;
    descriptions: {
        location: string;
        time: string;
        weather: string;
    };
    location: string;
    locationType: LocationType;
}

type TimeOfDay = "night" | "morning" | "afternoon" | "evening";
type Season = "summer" | "winter" | "spring" | "autumn";

interface BiomeMixDescription {
    condition: (primary: BiomeType, secondary: BiomeType) => boolean;
    description: string;
}

interface BiomeDescriptionSettings {
    biomeDescriptors: { [key in BiomeType]: string[] };
    elevationDescriptors: string[];
    timeDescriptors: string[];
    biomeMixDescriptions: BiomeMixDescription[];
    defaultMixDescription: string;
    secondaryBiomeThreshold: number;
}

const locationDescriptionsSettings: BiomeDescriptionSettings = {
    biomeDescriptors: {
        grassland: [
            "rolling meadows of green and gold",
            "windswept plains where grasses dance",
            "verdant fields stretching to the horizon",
        ],
        forest: [
            "ancient trees with gnarled roots and whispering leaves",
            "mysterious woods where shadows play",
            "a canopy of green filtering dappled sunlight",
        ],
        desert: [
            "sun-baked sands shimmering like a mirage",
            "vast dunes sculpted by timeless winds",
            "a barren expanse where heat ripples the air",
        ],
        tundra: [
            "frost-kissed plains under an endless sky",
            "a stark beauty of ice and snow",
            "hardy shrubs clinging to life in the cold",
        ],
        underground: [
            "echoing caverns adorned with glittering crystals",
            "a labyrinth of stone where darkness dwells",
            "hidden passages carved by time and water",
        ],
        aquatic: [
            "crystal waters teeming with life unseen",
            "gentle waves lapping at the shore",
            "depths that hold secrets of ages past",
        ],
    },
    elevationDescriptors: [
        "In the lowlands, ",
        "Across the rolling hills, ",
        "High upon the mountainside, ",
    ],
    timeDescriptors: [
        "Time seems to slow in this timeless place. ",
        "Here, the ages of the world whisper their secrets. ",
        "In this land, every stone could tell a tale of old. ",
    ],
    biomeMixDescriptions: [
        {
            condition: (primary, secondary) =>
                primary === "grassland" && secondary === "forest",
            description:
                "groves of trees stand like islands in a sea of grass. ",
        },
        {
            condition: (primary, secondary) =>
                primary === "desert" && secondary === "grassland",
            description: "patches of hardy grass defy the arid landscape. ",
        },
        {
            condition: (primary, secondary) =>
                primary === "tundra" && secondary === "forest",
            description: "stunted trees huddle together against the cold. ",
        },
    ],
    defaultMixDescription: " intrudes upon the scene. ",
    secondaryBiomeThreshold: 0.3,
};

class MudDescriptionGenerator {
    public worldSeed: WorldSeed;
    public sanctuaries: Sanctuary[];
    public biomes: Record<string, Biome>;

    topologyResultCache?: CacheInterface;
    topologyBufferCache?: CacheInterface;
    topologyResponseCache?: CacheInterface;

    constructor({
        worldSeed,
        sanctuaries,
        biomes,
        topologyResultCache,
        topologyBufferCache,
        topologyResponseCache,
    }: {
        worldSeed: WorldSeed;
        sanctuaries: Sanctuary[];
        biomes: Record<string, Biome>;
        topologyResultCache?: CacheInterface;
        topologyBufferCache?: CacheInterface;
        topologyResponseCache?: CacheInterface;
    }) {
        this.worldSeed = worldSeed;
        this.sanctuaries = sanctuaries;
        this.biomes = biomes;
        this.topologyResultCache = topologyResultCache;
        this.topologyBufferCache = topologyBufferCache;
        this.topologyResponseCache = topologyResponseCache;
    }

    async monsterDescriptions(monsters: Monster[]) {
        return generateDescription(monsters, "monster");
    }

    async itemDescriptions(items: Item[]) {
        return generateDescription(items, "item");
    }

    async playerDescriptions(players: Player[]) {
        return generateDescription(players, "player");
    }

    async locationDescriptions(
        location: string,
        locationType: LocationType,
        time?: number,
    ): Promise<Descriptor> {
        time = time ?? Date.now();
        const {
            description: timeDescription,
            timeOfDay,
            season,
        } = this.getTimeInfo(time);

        const descriptor: Descriptor = {
            name: location || "The Abyss", // TODO: Get appropriate name
            descriptions: {
                location: "You are nowhere to be found",
                // Time description
                time: timeDescription,
                // Weather description
                weather: this.getWeatherInfo({
                    location,
                    locationType,
                    time,
                    season,
                    timeOfDay,
                }),
            },
            location,
            locationType,
        };

        if (geohashLocationTypes.has(locationType)) {
            const elevation = await elevationAtGeohash(location, "geohash", {
                responseCache: this.topologyResponseCache,
                resultsCache: this.topologyResultCache,
                bufferCache: this.topologyBufferCache,
            });
            const city = location.slice(
                0,
                this.worldSeed.spatial.city.precision,
            );
            const biomeParameters = await biomeParametersAtCity(city);
            // Biome description
            descriptor.descriptions.location = this.getBiomeDescription(
                city,
                biomeParameters,
                elevation,
                locationDescriptionsSettings,
            );
        }

        return descriptor;
    }

    getBiomeDescription(
        city: string,
        biomeParameters: BiomeParameters,
        elevation: number,
        settings: BiomeDescriptionSettings,
    ): string {
        const {
            biomeDescriptors,
            elevationDescriptors,
            timeDescriptors,
            biomeMixDescriptions,
            defaultMixDescription,
            secondaryBiomeThreshold,
        } = settings;

        // Sort biomes by probability
        const sortedBiomes = Object.entries(biomeParameters)
            .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))
            .filter(([, prob]) => prob && prob > 0);

        if (sortedBiomes.length === 0) {
            return "The land here defies description, a mystery even to the wisest.";
        }

        const rv = seededRandom(stringToRandomNumber(city));

        const primaryBiome = sortedBiomes[0][0] as BiomeType;
        const secondaryBiome = sortedBiomes[1]?.[0] as BiomeType | undefined;

        const getRandomDescriptor = (biome: BiomeType) =>
            biomeDescriptors[biome][
                Math.floor(rv * biomeDescriptors[biome].length)
            ];

        let description =
            elevationDescriptors[
                Math.min(
                    Math.floor(elevation / 1000),
                    elevationDescriptors.length - 1,
                )
            ];

        description += getRandomDescriptor(primaryBiome) + ". ";

        if (
            secondaryBiome &&
            biomeParameters[secondaryBiome]! > secondaryBiomeThreshold
        ) {
            description += "Yet, ";
            const mixDescription = biomeMixDescriptions.find((mix) =>
                mix.condition(primaryBiome, secondaryBiome),
            );
            if (mixDescription) {
                description += mixDescription.description;
            } else {
                description +=
                    getRandomDescriptor(secondaryBiome) + defaultMixDescription;
            }
        }

        description += timeDescriptors[Math.floor(rv * timeDescriptors.length)];

        return description;
    }

    getTimeInfo(time: number): {
        timeOfDay: TimeOfDay;
        season: Season;
        dayOfYear: number;
        description: string;
    } {
        const { dayLengthHours, yearLengthDays, seasonLengthDays } =
            this.worldSeed.time;

        const hourOfDay = (time / (1000 * 60 * 60)) % dayLengthHours;
        const dayOfYear =
            Math.floor(time / (1000 * 60 * 60 * 24)) % yearLengthDays;
        const season = Math.floor(dayOfYear / seasonLengthDays) % 4;

        let timeOfDay: TimeOfDay;
        if (hourOfDay < 6) timeOfDay = "night";
        else if (hourOfDay < 12) timeOfDay = "morning";
        else if (hourOfDay < 18) timeOfDay = "afternoon";
        else timeOfDay = "evening";

        const seasons: Season[] = ["spring", "summer", "autumn", "winter"];
        const currentSeason = seasons[season];

        return {
            timeOfDay,
            season: currentSeason,
            dayOfYear,
            description: `It is ${timeOfDay} during the ${currentSeason} season.`,
        };
    }

    private getWeatherInfo({
        location,
        locationType,
        timeOfDay,
        season,
        time,
    }: {
        location: string;
        locationType: LocationType;
        time: number;
        timeOfDay: TimeOfDay;
        season: Season;
    }): string {
        const continent = this.worldSeed.seeds.continent[location.charAt(0)];
        if (!geohashLocationTypes.has(locationType) || !continent) {
            return "";
        }

        const {
            baseTemperature,
            temperatureVariation,
            rainProbability,
            stormProbability,
        } = continent.weather;

        // Smallest resolution for weather is at the city level
        const city = location.slice(0, this.worldSeed.spatial.city.precision);

        // Use `city` and `timeOfDay` seed the random number generation (else it will change every cell)
        const rv = seededRandom(stringToRandomNumber(city + timeOfDay));

        // Adjust temperature based on season and time of day
        let temperatureAdjustment = 0;
        switch (season) {
            case "summer":
                temperatureAdjustment += temperatureVariation / 2;
                break;
            case "winter":
                temperatureAdjustment -= temperatureVariation / 2;
                break;
        }

        switch (timeOfDay) {
            case "night":
                temperatureAdjustment -= temperatureVariation / 4;
                break;
            case "afternoon":
                temperatureAdjustment += temperatureVariation / 4;
                break;
        }

        const temperature =
            baseTemperature + rv * temperatureVariation + temperatureAdjustment;

        // Adjust rain and storm probabilities based on season
        let rainAdjustment = 0;
        let stormAdjustment = 0;
        switch (season) {
            case "spring":
                rainAdjustment = 0.1;
                break;
            case "autumn":
                rainAdjustment = 0.05;
                stormAdjustment = 0.05;
                break;
        }
        const isRaining = rv < rainProbability + rainAdjustment;
        const isStorming = rv < stormProbability + stormAdjustment;

        let weatherDescription = `The temperature is ${Math.round(temperature)}°C.`;

        if (isStorming) {
            weatherDescription +=
                " A fierce storm is raging, with heavy rain and strong winds.";
            const humidityDesc = getHumidityDesc(
                continent.biome.forest ?? 0,
                temperature,
            );
            weatherDescription += ` The air feels ${getTempDesc(temperature)}${humidityDesc ? " and " + humidityDesc : ""}.`;
        } else if (isRaining) {
            weatherDescription += " It is raining steadily.";
            const humidityDesc = getHumidityDesc(
                continent.biome.forest ?? 0,
                temperature,
            );
            weatherDescription += ` The air feels ${getTempDesc(temperature)}${humidityDesc ? " and " + humidityDesc : ""}.`;
        } else {
            weatherDescription += " The sky is clear.";
            const humidityDesc = getHumidityDesc(
                continent.biome.forest ?? 0,
                temperature,
            );
            if (humidityDesc) {
                weatherDescription += ` The air is ${getTempDesc(temperature)} and ${humidityDesc}.`;
            } else {
                weatherDescription += ` The air is ${getTempDesc(temperature)}.`;
            }
        }

        return weatherDescription;
    }
}

type LanguageRules = {
    descriptors: [number, string][];
};

const languageRules: Record<EntityType, LanguageRules> = {
    player: {
        descriptors: [
            [1, "{name} is here"],
            [2, "{name} and {name} are here"],
            [3, "{name}, {name}, and {name} are here"],
            [5, "{names}, and {name} are here"],
            [10, "A small group of {count} adventurers are gathered here"],
            [20, "A band of {count} adventurers are gathered here"],
            [Infinity, "A massive gathering of {count} adventurers is here"],
        ],
    },
    monster: {
        descriptors: [
            [1, "You see a {name}"],
            [2, "You see a pair of {name}s"],
            [5, "You see a small group of {count} {name}s"],
            [10, "You see a pack of {count} {name}s"],
            [Infinity, "You see a horde of {count} {name}s"],
        ],
    },
    item: {
        descriptors: [
            [1, "You see a {name}"],
            [5, "You see {count} {name}s"],
            [Infinity, "You see {count} {name}s"],
        ],
    },
};

// Function to get humidity description based on continent water level
const getHumidityDesc = (water: number, temp: number) => {
    if (water > 0.5) {
        if (temp > 25) return "humid";
        if (temp < 10) return "damp";
        return "moist";
    } else if (water < 0.2) {
        return "dry";
    }
    return ""; // For moderate humidity, we'll omit it from the description
};

// Function to get temperature description
const getTempDesc = (temp: number) => {
    if (temp > 30) return "hot";
    if (temp > 20) return "warm";
    if (temp > 10) return "cool";
    return "cold";
};

function applyLanguageRules(
    entities: GameEntity[],
    rules: LanguageRules,
): string {
    const count = entities.length;
    if (count <= 0) {
        return "";
    }

    // Get descriptor
    let description = rules.descriptors[rules.descriptors.length - 1][1];
    for (const [threshold, template] of rules.descriptors) {
        if (count <= threshold) {
            description = template;
            break;
        }
    }

    // Replace placeholders
    description = description
        .replace(/{name}/g, entities[0].name)
        .replace(
            /{names}/g,
            entities
                .slice(0, -1)
                .map((e) => e.name)
                .join(", "),
        )
        .replace(/{count}/g, count.toString());

    return description;
}

function getAdditionalInfo(
    entities: GameEntity[],
    entityType: EntityType,
): string {
    const sample = entities[0];
    if (!sample) {
        return "";
    }

    // Monster
    if (entityType === "monster") {
        const monster = bestiary[(sample as Monster).beast];
        if (monster.alignment === "evil") {
            return " looking threateningly at you";
        }
    }
    // Item
    else if (entityType === "item") {
        const prop = (sample as Item).prop;
        if (compendium[prop].weight < 0) {
            return " firmly fixed in place";
        }
    }
    return "";
}

function generateDescription(
    entities: GameEntity[],
    entityType: EntityType,
): string {
    const entitiesByCategory = groupBy(entities, (e) => {
        if (entityType === "item") return (e as Item).prop;
        if (entityType === "monster") return (e as Monster).beast;
        return "player"; // players are all considered a single category
    });

    const descriptions: string[] = [];
    for (const group of Object.values(entitiesByCategory)) {
        let description = applyLanguageRules(group, languageRules[entityType]);
        description += getAdditionalInfo(group, entityType);
        description = description.trim();
        if (description) {
            descriptions.push(description);
        }
    }
    if (descriptions.length > 0) {
        return descriptions.join(". ") + ".";
    } else {
        return "";
    }
}
