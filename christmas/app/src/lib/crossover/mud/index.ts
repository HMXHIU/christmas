import type { CacheInterface } from "$lib/caches";
import type { Item, Monster, Player } from "$lib/crossover/types";
import { get } from "svelte/store";
import { itemRecord } from "../../../store";
import {
    biomeParametersAtCity,
    elevationAtGeohash,
    type Biome,
} from "../world/biomes";
import { itemAttibutes } from "../world/compendium";
import { worldSeed, type WorldSeed } from "../world/settings/world";
import { geohashLocationTypes, type LocationType } from "../world/types";
import {
    getGameTime,
    getSeason,
    getTimeOfDay,
    getWeather,
} from "../world/world";
import { describeBiome } from "./biome";
import { descibeEntities } from "./entities";
import { biomeDescriptors, entityDescriptors } from "./settings";

export { MudDescriptionGenerator, type LocationDescription };

interface LocationDescription {
    descriptions: {
        location: string; // description of the surroundings
        time: string;
        weather: string;
    };
    location: string; // the actual entity location (eg. loc[0])
    locationType: LocationType; // locT
    locationInstance: string; // locI
}

class MudDescriptionGenerator {
    public worldSeed: WorldSeed;
    public biomes: Record<string, Biome>;

    topologyResultCache?: CacheInterface;
    topologyBufferCache?: CacheInterface;
    topologyResponseCache?: CacheInterface;

    constructor({
        worldSeed,
        biomes,
        topologyResultCache,
        topologyBufferCache,
        topologyResponseCache,
    }: {
        worldSeed: WorldSeed;
        biomes: Record<string, Biome>;
        topologyResultCache?: CacheInterface;
        topologyBufferCache?: CacheInterface;
        topologyResponseCache?: CacheInterface;
    }) {
        this.worldSeed = worldSeed;
        this.biomes = biomes;
        this.topologyResultCache = topologyResultCache;
        this.topologyBufferCache = topologyBufferCache;
        this.topologyResponseCache = topologyResponseCache;
    }

    async descriptionsMonsters(player: Player, monsters: Monster[]) {
        return descibeEntities(player, monsters, "monster", entityDescriptors);
    }

    async describeItems(player: Player, items: Item[]) {
        return descibeEntities(player, items, "item", entityDescriptors);
    }

    async describePlayers(player: Player, players: Player[]) {
        return descibeEntities(player, players, "player", entityDescriptors);
    }

    async describeSurroundings(
        location: string,
        locationType: LocationType,
        locationInstance: string,
        time?: number,
    ): Promise<LocationDescription> {
        const timeDescription = describeTime();

        const description: LocationDescription = {
            descriptions: {
                location: "You are nowhere to be found",
                // Time description
                time: timeDescription,
                // Weather description
                weather: describeWeather({
                    location,
                    locationType,
                }),
            },
            location,
            locationType,
            locationInstance,
        };

        // Use item description if inside an item (eg. tavern)
        if (locationType === "in") {
            const item = get(itemRecord)?.[locationInstance];
            if (item) {
                description.descriptions.location =
                    itemAttibutes(item).description;
            }
        }
        // Use biome description
        else if (geohashLocationTypes.has(locationType)) {
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
            description.descriptions.location = describeBiome(
                city,
                biomeParameters,
                elevation,
                biomeDescriptors,
            );
        }

        return description;
    }
}

function describeTime(): string {
    const { day, hour, season } = getGameTime(worldSeed);
    let timeOfDay = getTimeOfDay(hour);
    const currentSeason = getSeason(season);
    return `It is ${timeOfDay} during the ${currentSeason} season.`;
}

function describeWeather({
    location,
    locationType,
}: {
    location: string;
    locationType: LocationType;
}): string {
    // Only describe weather in geohash locations
    if (!geohashLocationTypes.has(locationType)) {
        return "";
    }

    const { temperature, rain, storm, snow } = getWeather(worldSeed, location);
    let description = "";

    // Describe rain/storm/snow
    if (snow) {
        description +=
            "Snowflakes drift gently from the sky, covering the ground in a white blanket.";
    } else if (storm) {
        description +=
            "A fierce storm is raging, with heavy rain and strong winds.";
    } else if (rain) {
        description += "It is raining steadily.";
    } else {
        description += "The sky is clear.";
    }

    // Describe temperature
    description = `${description} ${describeTemperature(temperature)}.`;

    return description;
}

function describeTemperature(temp: number): string {
    if (temp > 35) return "The air is sweltering and stifling";
    if (temp > 30) return "The heat is oppressive and draining";
    if (temp > 25) return "The temperature is pleasantly warm";
    if (temp > 20) return "The temperature is mild and pleasant";
    if (temp > 15) return "There's a slight chill in the air";
    if (temp > 10) return "There's a chill in the air";
    if (temp > 5) return "The air is decidedly cold";
    if (temp > 0) return "The air is bitingly cold";
    return "The air is freezing cold, chilling to the bone";
}
