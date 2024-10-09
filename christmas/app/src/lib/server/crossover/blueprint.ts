import {
    evenGeohashCharacters,
    oddGeohashCharacters,
    territoriesIterator,
} from "$lib/crossover/utils";
import {
    blueprintsAtDungeon,
    blueprintsAtTerritory,
} from "$lib/crossover/world/blueprint";
import type { ItemVariables } from "$lib/crossover/world/compendium";
import { generateDungeonGraphsForTerritory } from "$lib/crossover/world/dungeons";
import { LOCATION_INSTANCE } from "$lib/crossover/world/settings";
import {
    blueprints,
    blueprintsToSpawn,
    dungeonBlueprints,
    dungeonBlueprintsToSpawn,
} from "$lib/crossover/world/settings/blueprint";
import type { GeohashLocation } from "$lib/crossover/world/types";
import { substituteVariablesRecursively } from "$lib/utils";
import { hashObject } from "..";
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
import { saveEntity } from "./redis/utils";
import type { ActorEntity, ItemEntity } from "./types";
import { parseItemVariables } from "./utils";

export { instantiateBlueprintsAtTerritories, instantiateBlueprintsInDungeons };

async function instantiateBlueprintsAtTerritories(
    locationType: GeohashLocation = "geohash",
    locationInstance: string = LOCATION_INSTANCE,
) {
    // Iterate over all territories
    for (const u of oddGeohashCharacters) {
        for (const v of evenGeohashCharacters) {
            const territory = u + v;

            // Instantiate blueprints
            console.info(`spawning items for blueprints at ${territory}`);
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
            for (const [loc, { prop }] of Object.entries(
                territoryBlueprint.stencil,
            )) {
                try {
                    if (prop) {
                        await spawnItemAtGeohash({
                            geohash: loc,
                            locationType,
                            prop,
                            locationInstance,
                        });
                    }
                } catch (error: any) {
                    console.warn(error.message);
                }
            }
        }
    }
}

async function instantiateBlueprintsInDungeons(
    locationType: GeohashLocation = "d1",
    locationInstance: string = LOCATION_INSTANCE,
    territories?: string[],
): Promise<ActorEntity[]> {
    const spawnedEntities: ActorEntity[] = [];

    // Iterate over all territories
    territories = territories ?? Array.from(territoriesIterator());
    for (const territory of territories) {
        // Instantiate dungeon blueprints
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

            const referencedEntities: Record<string, ActorEntity> = {}; // we only need 1 for variable substitution
            const entitiesToConfigure: {
                entity: ActorEntity;
                variables?: ItemVariables;
                overwrite?: Record<string, string | boolean | number>;
            }[] = [];

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
                },
            ] of Object.entries(dungeonBlueprint.stencil)) {
                try {
                    if (prop) {
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
                    if (beast) {
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
                    if (npc) {
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
            for (const {
                entity,
                variables,
                overwrite,
            } of entitiesToConfigure) {
                // Substitute and set entity vars
                if (entity.prop && variables) {
                    entity.vars = parseItemVariables(
                        substituteVariablesRecursively(
                            variables,
                            referencedEntities,
                        ),
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
        }
    }

    return spawnedEntities;
}
