import type { CacheInterface } from "$lib/caches";
import type { Item, Monster, Player } from "$lib/crossover/types";
import {
    biomeParametersAtCity,
    elevationAtGeohash,
    type Biome,
} from "../world/biomes";
import { type WorldSeed } from "../world/settings/world";
import { geohashLocationTypes, type LocationType } from "../world/types";
import { describeBiome } from "./biome";
import { descibeEntities } from "./entities";
import { biomeDescriptors, entityDescriptors } from "./settings";
import { describeTime } from "./time";
import { describeWeather } from "./weather";

export { MudDescriptionGenerator, type LocationDescription };

interface LocationDescription {
    descriptions: {
        location: string; // description of the surroundings
        time: string;
        weather: string;
    };
    location: string; // the actual entity location (eg. loc[0])
    locationType: LocationType; // locT
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

    async monsterDescriptions(monsters: Monster[]) {
        return descibeEntities(monsters, "monster", entityDescriptors);
    }

    async itemDescriptions(items: Item[]) {
        return descibeEntities(items, "item", entityDescriptors);
    }

    async playerDescriptions(players: Player[]) {
        return descibeEntities(players, "player", entityDescriptors);
    }

    async locationDescriptions(
        location: string,
        locationType: LocationType,
        time?: number,
    ): Promise<LocationDescription> {
        time = time ?? Date.now();
        const {
            description: timeDescription,
            timeOfDay,
            season,
        } = describeTime(time);

        const description: LocationDescription = {
            descriptions: {
                location: "You are nowhere to be found",
                // Time description
                time: timeDescription,
                // Weather description
                weather: describeWeather({
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
