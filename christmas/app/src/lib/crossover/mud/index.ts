import type {
    EntityType,
    GameEntity,
    Item,
    Monster,
    Player,
} from "$lib/server/crossover/redis/entities";
import { groupBy } from "lodash-es";
import { seededRandom, stringToRandomNumber } from "../utils";
import { biomeAtGeohash, type Biome } from "../world/biomes";
import { bestiary } from "../world/settings/bestiary";
import { compendium } from "../world/settings/compendium";
import { type WorldSeed } from "../world/settings/world";
import {
    geohashLocationTypes,
    type GeohashLocationType,
    type LocationType,
} from "../world/types";
import type { Sanctuary } from "../world/world";

export { MudDescriptionGenerator, type Descriptor };

interface Descriptor {
    name: string;
    descriptions: {
        location: string;
        time: string;
        weather: string;
        players: string;
        monsters: string;
        items: string;
    };
    location: string;
    locationType: LocationType;
}

class MudDescriptionGenerator {
    public worldSeed: WorldSeed;
    public sanctuaries: Sanctuary[];
    public biomes: Record<string, Biome>;

    constructor({
        worldSeed,
        sanctuaries,
        biomes,
    }: {
        worldSeed: WorldSeed;
        sanctuaries: Sanctuary[];
        biomes: Record<string, Biome>;
    }) {
        this.worldSeed = worldSeed;
        this.sanctuaries = sanctuaries;
        this.biomes = biomes;
    }

    async descriptionAtLocation(
        location: string,
        locationType: LocationType,
        options?: {
            time?: number;
            monsters?: Monster[];
            items?: Item[];
            players?: Player[];
        },
    ): Promise<Descriptor> {
        const time = options?.time ?? Date.now();
        const {
            description: timeDescription,
            timeOfDay,
            season,
        } = this.getTimeInfo(time);

        const descriptor: Descriptor = {
            name: location || "The Abyss", // TODO: Get appropriate name
            descriptions: {
                location: "You are nowhere to be found",
                players: "",
                monsters: "",
                items: "",
                time: timeDescription,
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
            const [biome, strength] = await biomeAtGeohash(
                location,
                locationType as GeohashLocationType,
            );
            descriptor.descriptions.location = this.biomes[biome].description;
        }

        if (options?.monsters) {
            descriptor.descriptions.monsters = generateDescription(
                options.monsters,
                "monster",
            );
        }
        if (options?.items) {
            descriptor.descriptions.items = generateDescription(
                options.items,
                "item",
            );
        }
        if (options?.players) {
            descriptor.descriptions.players = generateDescription(
                options.players,
                "player",
            );
        }

        return descriptor;
    }

    getTimeInfo(time: number): {
        timeOfDay: string;
        season: string;
        dayOfYear: number;
        description: string;
    } {
        const { dayLengthHours, yearLengthDays, seasonLengthDays } =
            this.worldSeed.time;

        const hourOfDay = (time / (1000 * 60 * 60)) % dayLengthHours;
        const dayOfYear =
            Math.floor(time / (1000 * 60 * 60 * 24)) % yearLengthDays;
        const season = Math.floor(dayOfYear / seasonLengthDays) % 4;

        let timeOfDay: string;
        if (hourOfDay < 6) timeOfDay = "night";
        else if (hourOfDay < 12) timeOfDay = "morning";
        else if (hourOfDay < 18) timeOfDay = "afternoon";
        else timeOfDay = "evening";

        const seasons = ["spring", "summer", "autumn", "winter"];
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
        timeOfDay: string;
        season: string;
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

        // Use location and time to seed the random number generation
        const rv = seededRandom(
            stringToRandomNumber(location + time.toString()),
        );
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
            const humidityDesc = getHumidityDesc(continent.water, temperature);
            weatherDescription += ` The air feels ${getTempDesc(temperature)}${humidityDesc ? " and " + humidityDesc : ""}.`;
        } else if (isRaining) {
            weatherDescription += " It is raining steadily.";
            const humidityDesc = getHumidityDesc(continent.water, temperature);
            weatherDescription += ` The air feels ${getTempDesc(temperature)}${humidityDesc ? " and " + humidityDesc : ""}.`;
        } else {
            weatherDescription += " The sky is clear.";
            const humidityDesc = getHumidityDesc(continent.water, temperature);
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
