import type {
    EntityType,
    GameEntity,
    Item,
    Monster,
    Player,
} from "$lib/server/crossover/redis/entities";
import { groupBy } from "lodash-es";
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

        const descriptor: Descriptor = {
            name: "The Abyss",
            descriptions: {
                location: "You are nowhere to be found",
                players: "",
                monsters: "",
                items: "",
            },
            location,
            locationType,
        };

        if (geohashLocationTypes.has(locationType)) {
            const [biome, strength] = await biomeAtGeohash(
                location,
                locationType as GeohashLocationType,
            );
            descriptor.location = this.biomes[biome].description;
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
