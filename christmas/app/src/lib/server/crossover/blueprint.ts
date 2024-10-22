import {
    blueprintsAtDungeon,
    blueprintsAtTerritory,
} from "$lib/crossover/world/blueprint";
import type { Stencil } from "$lib/crossover/world/blueprint/types";
import type { ItemVariables } from "$lib/crossover/world/compendium";
import { generateDungeonGraphsForTerritory } from "$lib/crossover/world/dungeons";
import { LOCATION_INSTANCE } from "$lib/crossover/world/settings";
import type { Faction } from "$lib/crossover/world/settings/affinities";
import {
    blueprints,
    blueprintsToSpawn,
    dungeonBlueprints,
    dungeonBlueprintsToSpawn,
} from "$lib/crossover/world/settings/blueprint";
import { compendium } from "$lib/crossover/world/settings/compendium";
import type { GeohashLocation } from "$lib/crossover/world/types";
import { substituteVariablesRecursively } from "$lib/utils";
import { hashObject } from "..";
import { factionInControl } from "./actions/capture";
import {
    blueprintsAtLocationCache,
    dungeonGraphCache,
    dungeonsAtTerritoryCache,
    topologyBufferCache,
    topologyResponseCache,
    topologyResultCache,
} from "./caches";
import { spawnItemAtGeohash, spawnMonster } from "./dm";
import { spawnNPC } from "./npc";
import { controlMonumentsQuerySet } from "./redis/queries";
import { saveEntity } from "./redis/utils";
import type { ActorEntity, ItemEntity } from "./types";
import { parseItemVariables } from "./utils";

export { spawnDungeonBlueprints, spawnGeohashBlueprints };

async function spawnGeohashBlueprints(
    territory: string,
    locationType: GeohashLocation,
    locationInstance: string = LOCATION_INSTANCE,
    options?: {
        only?: {
            prop?: string[];
            beast?: string[];
            npc?: string[];
        };
        exclude?: {
            prop?: string[];
            beast?: string[];
            npc?: string[];
        };
    },
): Promise<ActorEntity[]> {
    // Can only spawn on geohash
    if (locationType !== "geohash") return [];

    // Get blueprints
    const territoryBlueprint = await blueprintsAtTerritory(
        territory,
        locationType,
        blueprints,
        blueprintsToSpawn,
        {
            topologyBufferCache,
            topologyResponseCache,
            topologyResultCache,
            blueprintsAtLocationCache,
        },
    );

    // Spawn stencil entities
    return await spawnStencil(
        territoryBlueprint.stencil,
        locationType,
        locationInstance,
        options,
    );
}

async function spawnDungeonBlueprints(
    territory: string,
    locationType: GeohashLocation,
    locationInstance: string = LOCATION_INSTANCE,
    options?: {
        only?: {
            prop?: string[];
            beast?: string[];
            npc?: string[];
        };
        exclude?: {
            prop?: string[];
            beast?: string[];
            npc?: string[];
        };
    },
): Promise<ActorEntity[]> {
    // Can only spawn underground (eg. d1, d2, ..)
    if (locationType === "geohash") return [];

    const spawnedEntities: ActorEntity[] = [];

    // Get dungeon blueprints
    const dungeonGraphs = await generateDungeonGraphsForTerritory(
        territory,
        locationType,
        {
            dungeonGraphCache,
            dungeonsAtTerritoryCache,
            topologyResponseCache,
            topologyResultCache,
            topologyBufferCache,
        },
    );
    for (const graph of Object.values(dungeonGraphs)) {
        const dungeonBlueprint = await blueprintsAtDungeon(
            graph.dungeon,
            locationType,
            dungeonBlueprints,
            dungeonBlueprintsToSpawn,
            {
                blueprintsAtLocationCache,
                dungeonGraphCache,
            },
        );

        // Spawn stencil entities
        spawnedEntities.push(
            ...(await spawnStencil(
                dungeonBlueprint.stencil,
                locationType,
                locationInstance,
                options,
            )),
        );
    }

    return spawnedEntities;
}

async function spawnStencil(
    stencil: Stencil,
    locationType: GeohashLocation,
    locationInstance: string = LOCATION_INSTANCE,
    options?: {
        only?: {
            prop?: string[];
            beast?: string[];
            npc?: string[];
        };
        exclude?: {
            prop?: string[];
            beast?: string[];
            npc?: string[];
        };
    },
): Promise<ActorEntity[]> {
    const spawnedEntities: ActorEntity[] = [];
    const referencedEntities: Record<string, ActorEntity> = {}; // we only need 1 for variable substitution
    const entitiesToConfigure: {
        entity: ActorEntity;
        variables?: ItemVariables;
        overwrite?: Record<string, string | boolean | number>;
    }[] = [];

    // Get the faction in control of each monument spawned by each blueprint
    const factionInControlOfBlueprint: Record<string, Faction> = {};
    for (const [geohash, { prop, blueprint }] of Object.entries(stencil)) {
        if (prop === compendium.control.prop) {
            const monument = (await controlMonumentsQuerySet(
                geohash,
                locationType,
                locationInstance,
            ).first()) as ItemEntity;
            if (monument) {
                const faction = factionInControl(monument);
                if (faction) {
                    factionInControlOfBlueprint[blueprint] = faction;
                }
            }
            break;
        }
    }

    // Spawn entities
    for (const [
        loc,
        {
            prop,
            beast,
            npc,
            ref,
            variables,
            overwrite,
            unique,
            blueprint,
            faction,
        },
    ] of Object.entries(stencil)) {
        // Check stencil faction is the faction in control of the blueprint
        if (faction && factionInControlOfBlueprint[blueprint] !== faction) {
            continue;
        }

        try {
            // Spawn items
            if (prop) {
                if (
                    options?.exclude?.prop &&
                    options.exclude.prop.includes(prop)
                )
                    continue;
                if (options?.only && !options.only?.prop?.includes(prop))
                    continue;

                const uniqueSuffix: string | undefined = unique
                    ? hashObject([blueprint, prop, loc], "md5")
                    : undefined;
                const item = await spawnItemAtGeohash({
                    geohash: loc,
                    locationType,
                    prop,
                    locationInstance,
                    destroyCollidingEntities: true, // prevent creating multiple of the same entities
                    ignoreCollider: true, // should spawn even in untraversable locations
                    uniqueSuffix, // destroy any existing if unique
                });
                if (ref && !referencedEntities[ref]) {
                    referencedEntities[ref] = item;
                }
                if (variables || overwrite) {
                    entitiesToConfigure.push({
                        entity: item,
                        overwrite,
                        variables,
                    });
                }
                spawnedEntities.push(item);
            }
            // Spawn monsters
            if (beast) {
                if (
                    options?.exclude?.beast &&
                    options.exclude.beast.includes(beast)
                )
                    continue;
                if (options?.only && !options.only?.beast?.includes(beast))
                    continue;

                const uniqueSuffix: string | undefined = unique
                    ? hashObject([blueprint, beast, loc], "md5")
                    : undefined;
                const monster = await spawnMonster({
                    geohash: loc,
                    locationType,
                    beast,
                    locationInstance,
                    uniqueSuffix,
                });
                if (ref && !referencedEntities[ref]) {
                    referencedEntities[ref] = monster;
                }
                if (variables || overwrite) {
                    entitiesToConfigure.push({
                        entity: monster,
                        overwrite,
                        variables,
                    });
                }
                spawnedEntities.push(monster);
            }
            // Spawn npcs
            if (npc) {
                if (options?.exclude?.npc && options.exclude.npc.includes(npc))
                    continue;
                if (options?.only && !options.only?.npc?.includes(npc))
                    continue;

                const uniqueSuffix: string | undefined = unique
                    ? hashObject([blueprint, npc, loc], "md5")
                    : undefined;
                const player = await spawnNPC(npc, {
                    demographic: {},
                    appearance: {},
                    geohash: loc,
                    locationInstance,
                    locationType,
                    uniqueSuffix,
                });
                if (ref && !referencedEntities[ref]) {
                    referencedEntities[ref] = player;
                }
                if (variables || overwrite) {
                    entitiesToConfigure.push({
                        entity: player,
                        overwrite,
                        variables,
                    });
                }
                spawnedEntities.push(player);
            }
        } catch (error: any) {
            console.warn(error.message);
        }
    }

    // Configure entities
    for (const { entity, variables, overwrite } of entitiesToConfigure) {
        // Substitute and set entity vars
        if (entity.prop && variables) {
            entity.vars = parseItemVariables(
                substituteVariablesRecursively(variables, referencedEntities),
                (entity as ItemEntity).prop,
            );
        }
        // Substitute and set entity properties
        if (overwrite) {
            for (const [k, v] of Object.entries(overwrite)) {
                entity[k] = v;
            }
        }
        // Save entity
        await saveEntity(entity);
    }

    return spawnedEntities;
}
