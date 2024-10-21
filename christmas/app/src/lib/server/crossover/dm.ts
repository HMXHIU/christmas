import type { CacheInterface } from "$lib/caches";
import type { Skills } from "$lib/crossover/types";
import {
    autoCorrectGeohashPrecision,
    borderingGeohashes,
    calculateLocation,
    childrenGeohashes,
    geohashDistance,
    getEntityId,
    getPlotsAtGeohash,
} from "$lib/crossover/utils";
import {
    defaultPropAttributes,
    type PropAttributes,
} from "$lib/crossover/world/compendium";
import { DUNGEON_PRECISION } from "$lib/crossover/world/dungeons";
import { entityStats, mergeAdditive } from "$lib/crossover/world/entity";
import { LOCATION_INSTANCE } from "$lib/crossover/world/settings";
import { factions } from "$lib/crossover/world/settings/affinities";
import { bestiary } from "$lib/crossover/world/settings/bestiary";
import { compendium } from "$lib/crossover/world/settings/compendium";
import {
    fetchSanctuaries,
    spatialAtPrecision,
    worldSeed,
} from "$lib/crossover/world/settings/world";
import {
    geohashLocationTypes,
    type GeohashLocation,
} from "$lib/crossover/world/types";
import {
    findClosestSanctuary,
    poisInWorld,
    type Sanctuary,
    type WorldPOIs,
} from "$lib/crossover/world/world";
import type {
    CreatureEntity,
    ItemEntity,
    MonsterEntity,
    PlayerEntity,
    WorldEntity,
} from "$lib/server/crossover/types";
import { substituteVariablesRecursively } from "$lib/utils";
import { generatePin } from "$lib/utils/random";
import { groupBy, uniq } from "lodash-es";
import { hashObject } from "..";
import { redisClient } from "../redis";
import { factionInControl } from "./actions/capture";
import { spawnDungeonBlueprints, spawnGeohashBlueprints } from "./blueprint";
import { spawnNPC } from "./npc";
import { itemRepository, monsterRepository, worldRepository } from "./redis";
import {
    chainOr,
    controlMonumentsQuerySet,
    itemsInGeohashQuerySet,
    loggedInPlayersQuerySet,
    monstersInGeohashQuerySet,
    worldsContainingGeohashQuerySet,
} from "./redis/queries";
import { saveEntity } from "./redis/utils";
import { isLocationTraversable, parseItemVariables } from "./utils";

export {
    respawnMonsters,
    spawnItemAtGeohash,
    spawnItemInInventory,
    spawnLocation,
    spawnMonster,
    spawnQuestItem,
    spawnWorld,
    spawnWorldPOIs,
};

const LOCATION_RESPAWN_TIMER = 60 * 60; // 1 hr

// TODO: Add time cache
async function checkCanSpawnMonsters(
    geohash: string,
    locationType: GeohashLocation,
    locationInstance: string,
): Promise<boolean> {
    const numMonsters = await monstersInGeohashQuerySet(
        [geohash],
        locationType as GeohashLocation,
        locationInstance,
    ).count();
    const spatial = spatialAtPrecision(geohash.length);

    if (spatial) {
        const monsterLimit = worldSeed.constants.monsterLimit[spatial];
        if (numMonsters < monsterLimit) {
            if (spatial === "continent") {
                return true;
            } else {
                return await checkCanSpawnMonsters(
                    geohash.slice(0, -1),
                    locationType,
                    locationInstance,
                );
            }
        }
    }

    return false;
}

/**
 * Respawns monsters in locationInstance (defaults to actual game world @) considering the provided players locations
 *
 * @param players - An array of PlayerEntity objects representing the players' locations.
 * @returns A Promise that resolves when all the monsters have been spawned.
 */
async function respawnMonsters({
    players,
    locationInstance,
}: {
    players?: string[];
    locationInstance?: string;
}) {
    locationInstance = locationInstance ?? LOCATION_INSTANCE;
    let qs = loggedInPlayersQuerySet().where("locI").equal(locationInstance);
    if (players && players.length > 0) {
        qs = chainOr(qs, "player", players);
    }

    const spawned: Record<string, number> = {};

    // Get all players
    const playerEntities = (await qs.return.all()) as PlayerEntity[];

    for (const [locationType, ps] of Object.entries(
        groupBy(playerEntities, "locT"),
    )) {
        // Get all parent geohashes (only interested with geohashes 1 level above unit precision)
        const parentGeohashes = uniq(ps.map(({ loc }) => loc[0].slice(0, -1)));

        // Get all peripheral geohashes where there are no players
        const peripheralGeohashes = borderingGeohashes(parentGeohashes);
        for (const geohash of peripheralGeohashes) {
            // Check if can spawn
            if (
                !(await checkCanSpawnMonsters(
                    geohash,
                    locationType as GeohashLocation,
                    locationInstance,
                ))
            ) {
                continue;
            }

            // Get number of monsters in geohash
            const numMonsters = await monstersInGeohashQuerySet(
                [geohash],
                locationType as GeohashLocation,
                locationInstance,
            ).count();

            // Number of monsters to spawn
            const spatial = spatialAtPrecision(geohash.length);
            if (!spatial) {
                continue;
            }
            const monsterLimit = worldSeed.constants.monsterLimit[spatial];
            const numMonstersToSpawn = monsterLimit - numMonsters;

            // Shuffle child geohashes to spawn monsters
            const childGeohashes = childrenGeohashes(geohash).sort(
                () => Math.random() - 0.5,
            );
            for (let i = 0; i < numMonstersToSpawn; i++) {
                // Get a random child geohash
                const childGeohash = childGeohashes[i % childGeohashes.length];

                // TODO: use PG to get random beast
                const beast = bestiary.goblin.beast;

                try {
                    const monster = await spawnMonster({
                        geohash: childGeohash,
                        locationType: locationType as GeohashLocation,
                        beast,
                        locationInstance,
                    });
                    spawned[monster.beast] =
                        spawned[monster.beast] == null
                            ? 1
                            : spawned[monster.beast] + 1;
                } catch (error) {
                    console.log(`Error spawning ${beast}`, error);
                }
            }
        }
    }

    return spawned;
}

/**
 * Spawns a monster in a specific geohash.
 *
 * @param geohash The geohash where the monster will be spawned.
 * @param beast The type of monster to spawn.
 * @returns A promise that resolves to the spawned monster entity.
 * @throws Error if the specified beast is not found in the bestiary.
 */
async function spawnMonster({
    geohash,
    locationType,
    locationInstance,
    beast,
    additionalSkills,
    uniqueSuffix,
}: {
    geohash: string;
    locationType: GeohashLocation;
    locationInstance: string;
    beast: string;
    additionalSkills?: Skills;
    uniqueSuffix?: string;
}): Promise<MonsterEntity> {
    if (!geohashLocationTypes.has(locationType)) {
        throw new Error("Can only spawn monster on GeohashLocation");
    }

    // Calculate location
    const asset = bestiary[beast].asset;
    const width = asset.width ?? 1;
    const height = asset.height ?? 1;
    const precision = asset.precision ?? worldSeed.spatial.unit.precision;

    // Auto correct geohash precision
    if (geohash.length !== precision) {
        geohash = autoCorrectGeohashPrecision(geohash, precision);
    }

    // Check location for traversability and colliders
    const location = calculateLocation(geohash, width, height);
    if (
        !(await isLocationTraversable(location, locationType, locationInstance))
    ) {
        throw new Error(
            `Cannot spawn ${beast} at ${geohash}, ${location} is untraversable`,
        );
    }

    // Add any additional skills
    const skills = additionalSkills
        ? mergeAdditive(additionalSkills, bestiary[beast].skills)
        : bestiary[beast].skills;

    // Get monster suffix
    const suffix = uniqueSuffix
        ? `${beast}${uniqueSuffix}`
        : `${beast}${await monsterRepository.search().count()}${generatePin(4)}`; // prevent race condition by generating additional pin
    const monsterId = `monster_${suffix}`;

    // Destroy any monster with the same uniqueSuffix if provided
    if (uniqueSuffix) {
        await monsterRepository.remove(monsterId);
    }

    // Get monster stats
    let monster: MonsterEntity = {
        monster: monsterId,
        name: beast,
        beast,
        loc: location,
        locT: locationType,
        locI: locationInstance,
        hp: 0,
        mnd: 0,
        cha: 0,
        lum: 0,
        umb: 0,
        skills,
        buclk: 0,
        buf: [],
        dbuf: [],
        pthclk: 0,
        pthdur: 0,
        pth: [],
        pthst: "",
    };
    monster = { ...monster, ...entityStats(monster) };

    return (await monsterRepository.save(monsterId, monster)) as MonsterEntity;
}

/**
 * Spawns a world asset from a tiled map in the plot the geohash is in.
 * A plot represents a full grid of 32 geohashes no matter the precision.
 *
 * Note:
 * - World assets must be exact multiples of a plot.
 *
 * @param geohash - The geohash of the world asset.
 * @param assetUrl - The URL of the asset (required to be rendered).
 * @param tileHeight - The height of a tile in game (asset tileheight might be different).
 * @param tileWidth - The width of a tile in game (asset tilewidth might be different).
 * @returns A promise that resolves to a WorldEntity.
 */
async function spawnWorld({
    geohash,
    locationType,
    assetUrl,
    tileHeight,
    tileWidth,
    world,
}: {
    world?: string; // use this as the worldId if specified
    geohash: string;
    locationType: GeohashLocation;
    assetUrl: string;
    tileHeight: number;
    tileWidth: number;
}): Promise<WorldEntity> {
    // If world is specified, check if world already exists
    if (world) {
        const worldEntity = await worldRepository
            .search()
            .where("world")
            .equal(world)
            .first();
        if (worldEntity) return worldEntity as WorldEntity;
    }

    if (!geohashLocationTypes.has(locationType)) {
        throw new Error("Can only spawn world on GeohashLocation");
    }

    // Auto correct geohash to unit precision
    if (geohash.length !== worldSeed.spatial.unit.precision) {
        geohash = autoCorrectGeohashPrecision(
            geohash,
            worldSeed.spatial.unit.precision,
        );
    }

    // Get the origin cell of the plot (top left)
    geohash = childrenGeohashes(geohash.slice(0, -1))[0];

    // Get asset from URL or if provided
    const asset = await (await fetch(assetUrl)).json();
    const {
        height,
        width,
        layers,
        tileheight: assetTileHeight,
        tilewidth: assetTileWidth,
    } = asset!;

    // Check asset dimensions multiples of tile dimensions
    if (
        assetTileWidth % tileWidth !== 0 ||
        assetTileHeight % tileHeight !== 0
    ) {
        throw new Error(
            `Asset tile width and height must be exact multiples of tile width and height`,
        );
    }

    // Get plot geohashes
    const heightMultiplier = assetTileHeight / tileHeight;
    const widthMultiplier = assetTileWidth / tileWidth;
    const plotGeohashes = getPlotsAtGeohash(
        geohash,
        height * heightMultiplier,
        width * widthMultiplier,
    );

    const existingWorlds = await worldsContainingGeohashQuerySet(
        plotGeohashes,
        locationType,
    ).all();
    if (existingWorlds.length > 0) {
        throw new Error(
            `Cannot spawn world on existing worlds ${existingWorlds.map((w) => (w as WorldEntity).world)}`,
        );
    }

    // Get world count
    const count = await worldRepository.search().count();
    world = world ?? `world_${count}`; // use world if specified

    // Create world asset
    const entity: WorldEntity = {
        world,
        uri: assetUrl || "",
        loc: plotGeohashes, // TODO: this can be optimized not just at unit precision -1
        locT: locationType,
    };

    return (await worldRepository.save(world, entity)) as WorldEntity;
}

async function spawnQuestItem({
    quest,
    prop,
    variables,
    owner,
    configOwner,
}: {
    quest: string;
    prop: string;
    variables?: Record<string, any>;
    owner?: string;
    configOwner?: string;
}): Promise<ItemEntity> {
    // Owner defaults to public
    owner ??= "";
    configOwner ??= "";

    // Get prop
    const { durability, charges, collider, states } = compendium[prop];

    // Substitute variables for default state attributes
    const attributes: PropAttributes = substituteVariablesRecursively(
        states.default,
        variables ?? {},
    );

    // Get item id
    const count = await itemRepository.search().count();
    const itemId = `item_${prop}${count}${generatePin(4)}`; // Instead of locking, we use a random pin in addition to the count to prevent race condition

    const item: ItemEntity = {
        item: itemId,
        name: attributes.name,
        prop,
        loc: [quest],
        locT: "quest",
        locI: LOCATION_INSTANCE,
        own: owner,
        cfg: configOwner,
        cld: collider,
        dur: durability,
        chg: charges,
        state: "default",
        vars: parseItemVariables(variables || {}, prop),
        dbuf: [],
        buf: [],
    };

    return (await itemRepository.save(itemId, item)) as ItemEntity;
}

async function spawnItemInInventory({
    entity,
    prop,
    variables,
    owner,
    configOwner,
}: {
    entity: CreatureEntity;
    prop: string;
    variables?: Record<string, any>;
    owner?: string;
    configOwner?: string;
}): Promise<ItemEntity> {
    // Owner defaults to public
    owner ??= "";
    configOwner ??= "";

    // Get prop
    const { states, durability, charges, collider } = compendium[prop];

    // Get default attributes (substitute provided variables first, then default)
    const attributes: PropAttributes = substituteVariablesRecursively(
        substituteVariablesRecursively(states.default, variables ?? {}),
        defaultPropAttributes(prop),
    );

    // Get item count
    const count = await itemRepository.search().count();
    const itemId = `item_${prop}${count}${generatePin(4)}`;
    const [entityId, entityType] = getEntityId(entity);

    return (await itemRepository.save(itemId, {
        item: itemId,
        name: attributes.name,
        prop,
        loc: [entityId],
        locT: "inv",
        locI: LOCATION_INSTANCE,
        own: owner,
        cfg: configOwner,
        cld: collider,
        dur: durability,
        chg: charges,
        state: variables?.state ?? "default",
        vars: parseItemVariables(variables || {}, prop),
        dbuf: [],
        buf: [],
    })) as ItemEntity;
}

/**
 * Spawns an item with the given geohash and prop.
 *
 * @param geohash - The geohash for the item.
 * @param prop - The prop in the compendium for the item.
 * @param owner - Who owns or can use the item (player | monster | public (default="") | dm).
 * @param configOwner - Who can configure the item (player | monster | public (default="") | dm).
 * @param variables - The variables for the item.
 * @param uniqueSuffix - A unique suffix for the item id, if provided will destroy any existing item with the same id
 * @returns A promise that resolves to the spawned item entity.
 */
async function spawnItemAtGeohash({
    geohash,
    locationType,
    locationInstance,
    prop,
    variables,
    owner,
    configOwner,
    ignoreCollider,
    destroyCollidingEntities,
    uniqueSuffix,
}: {
    geohash: string;
    locationType: GeohashLocation;
    locationInstance: string;
    prop: string;
    owner?: string;
    configOwner?: string;
    variables?: Record<string, any>;
    ignoreCollider?: boolean;
    destroyCollidingEntities?: boolean;
    uniqueSuffix?: string;
}): Promise<ItemEntity> {
    // Owner defaults to public
    owner ??= "";
    configOwner ??= "";

    if (!geohashLocationTypes.has(locationType)) {
        throw new Error("Can only spawn item on GeohashLocation");
    }

    // Get prop
    const { states, durability, charges, collider } = compendium[prop];

    // Get default attributes (substitute provided variables first, then default)
    const attributes: PropAttributes = substituteVariablesRecursively(
        substituteVariablesRecursively(states.default, variables ?? {}),
        defaultPropAttributes(prop),
    );

    const asset = compendium[prop].asset;
    const width = asset?.width ?? 1;
    const height = asset?.height ?? 1;
    const precision = asset?.precision ?? worldSeed.spatial.unit.precision;

    // Auto correct geohash precision
    if (geohash.length !== precision) {
        geohash = autoCorrectGeohashPrecision(geohash, precision);
    }

    // Calculate location
    const location = calculateLocation(geohash, width, height);

    // Destroy colliding entities at spawn point
    if (destroyCollidingEntities) {
        for (const item of (await itemsInGeohashQuerySet(
            location,
            locationType,
            locationInstance,
        ).returnAll()) as ItemEntity[]) {
            if (item.cld) {
                await itemRepository.remove(item.item);
            }
        }
    }

    // Check location for traversability
    if (
        !ignoreCollider &&
        !(await isLocationTraversable(location, locationType, locationInstance))
    ) {
        throw new Error(`Cannot spawn ${prop} at ${location}`);
    }

    // Get item suffix
    const suffix = uniqueSuffix
        ? `${prop}${uniqueSuffix}`
        : `${prop}${await itemRepository.search().count()}${generatePin(4)}`;
    const itemId = `item_${suffix}`;

    // Destroy any item with the same uniqueSuffix if provided
    if (uniqueSuffix) {
        await itemRepository.remove(itemId);
    }

    // Check reserved state variable (determines the initial state, defaults to `default`)
    const entity: ItemEntity = {
        item: itemId,
        name: attributes.name,
        prop,
        loc: location,
        locT: locationType,
        locI: locationInstance,
        own: owner,
        cfg: configOwner,
        cld: collider,
        dur: durability,
        chg: charges,
        state: variables?.state ?? "default",
        vars: parseItemVariables(variables || {}, prop),
        dbuf: [],
        buf: [],
    };

    return (await itemRepository.save(itemId, entity)) as ItemEntity;
}

/**
 * Spawn the blueprint props at a location (max every LOCATION_RESPAWN_TIMER).
 * This should be called regularly
 */
async function spawnLocation(
    geohash: string,
    locationType: GeohashLocation,
    locationInstance: string,
) {
    // Check location
    if (!geohashLocationTypes.has(locationType)) return;
    const territory = geohash.slice(0, worldSeed.spatial.territory.precision);

    // Skip if has been initialized in the last `LOCATION_RESPAWN_TIMER` seconds
    const spawnLocationKey = `spawn-${territory}-${locationType}-${locationInstance}`;
    if (await redisClient.get(spawnLocationKey)) {
        return;
    }
    // Set the spawn spawnLocationKey immediately to prevent race conditions
    await redisClient.set(spawnLocationKey, new Date().getTime(), {
        EX: LOCATION_RESPAWN_TIMER,
    });

    // Spawn control monuments to determine faction control
    if (locationType === "geohash") {
        await spawnGeohashBlueprints(
            territory,
            locationType,
            locationInstance,
            {
                only: { prop: [compendium.control.prop] },
            },
        );
    } else if (locationType === "d1") {
        await spawnDungeonBlueprints(
            territory,
            locationType,
            locationInstance,
            {
                only: { prop: [compendium.control.prop] },
            },
        );
    }

    // Initialize faction control (initial influence of control monuments)
    const sanctuaries = await fetchSanctuaries();
    await initializeFactionControl(
        territory,
        locationType,
        locationInstance,
        sanctuaries,
    );

    // Spawn Entities
    if (locationType === "geohash") {
        await spawnGeohashBlueprints(
            territory,
            locationType,
            locationInstance,
            {
                exclude: { prop: [compendium.control.prop] },
            },
        );
    } else if (locationType === "d1") {
        await spawnDungeonBlueprints(
            territory,
            locationType,
            locationInstance,
            {
                exclude: { prop: [compendium.control.prop] },
            },
        );
    }
}

async function initializeFactionControl(
    territory: string,
    locationType: GeohashLocation,
    locationInstance: string,
    sanctuaries: Sanctuary[],
) {
    const initialInfluence = 100000;
    const distanceToInfluenceFactor = 2;
    const startingHumanFaction = factions.historian.faction;
    const startingMonsterFaction = factions.meatshield.faction;

    // Get monuments in territory location type
    const monuments = (await controlMonumentsQuerySet(
        territory,
        locationType,
        locationInstance,
    ).returnAll()) as ItemEntity[];

    for (const monument of monuments) {
        // Check if has already been initialized (already has a faction)
        if (factionInControl(monument)) continue;

        const monumentLocation = monument.loc[0];
        const dungeon = monumentLocation.slice(0, DUNGEON_PRECISION);
        const sanctuary = sanctuaries.find((s) =>
            s.geohash.startsWith(dungeon),
        );
        // Monuments in dungeon sanctuaries are controlled by starting human faction
        if (sanctuary && locationType === "d1") {
            monument.vars[startingHumanFaction] = initialInfluence;
            await saveEntity(monument);
        }
        // Other monuments are controlled by starting monster faction (influence depends on distance from sanctuaries)
        else {
            const closestSanctuary =
                await findClosestSanctuary(monumentLocation);
            const distanceToClosestSanctuary = geohashDistance(
                monumentLocation,
                autoCorrectGeohashPrecision(
                    closestSanctuary.geohash,
                    monumentLocation.length,
                ),
            );
            monument.vars[startingMonsterFaction] = Math.floor(
                initialInfluence +
                    distanceToClosestSanctuary * distanceToInfluenceFactor,
            );
            console.log(
                `Set ${monument.item} influence ${startingMonsterFaction}:${monument.vars[startingMonsterFaction]}`,
            );
            await saveEntity(monument);
        }
    }
}

async function spawnWorldPOIs(
    world: string,
    locationInstance: string,
    options?: {
        source?: ItemEntity | PlayerEntity; // who spawned the world (used in variable substitution)
        worldAssetMetadataCache?: CacheInterface;
        worldPOIsCache?: CacheInterface;
    },
): Promise<{
    pois: WorldPOIs;
    items?: ItemEntity[];
    monsters?: MonsterEntity[];
    players?: PlayerEntity[];
}> {
    /*
    POIs (monsters, items, npcs) should be spawned with unique ids (similar to blueprints)
    so that they do not spawn multiple copies everytime this function is called
    */

    // Fetch world
    const worldEntity = (await worldRepository.fetch(world)) as WorldEntity;
    if (!worldEntity) {
        throw new Error(`${world} does not exist`);
    }

    // Get pois in world (for spawning items, monsters, players)
    const pois = await poisInWorld(worldEntity, options);
    const items: ItemEntity[] = [];
    const monsters: MonsterEntity[] = [];
    const players: PlayerEntity[] = [];

    for (const poi of pois) {
        try {
            // Spawn item (unique)
            if ("prop" in poi) {
                // Substitute variables with `source` if provided
                const variables = options?.source
                    ? substituteVariablesRecursively(poi.variables as any, {
                          source: options.source,
                      })
                    : poi.variables;

                const uniqueSuffix = hashObject(
                    [world, poi.prop, poi.geohash],
                    "md5",
                );
                const item = await spawnItemAtGeohash({
                    geohash: poi.geohash,
                    prop: poi.prop,
                    locationType: worldEntity.locT,
                    locationInstance,
                    variables,
                    uniqueSuffix,
                });
                console.info(
                    `Spawned ${item.item} in ${worldEntity.world} at ${locationInstance}`,
                );
                items.push(item);
            }
            // Spawn monster (unique)
            else if ("beast" in poi) {
                const uniqueSuffix = hashObject(
                    [world, poi.beast, poi.geohash],
                    "md5",
                );
                const monster = await spawnMonster({
                    geohash: poi.geohash,
                    locationType: worldEntity.locT,
                    locationInstance,
                    beast: poi.beast,
                    uniqueSuffix,
                });
                console.info(
                    `Spawned ${monster.monster} in ${worldEntity.world} at ${locationInstance}`,
                );
                monsters.push(monster);
            }
            // Spawn npc (unique)
            else if ("npc" in poi) {
                const uniqueSuffix = hashObject(
                    [world, poi.npc, poi.geohash],
                    "md5",
                );
                const player = await spawnNPC(poi.npc, {
                    demographic: {},
                    appearance: {},
                    geohash: poi.geohash,
                    locationInstance,
                    locationType: worldEntity.locT,
                    uniqueSuffix,
                });
                console.info(
                    `Spawned ${player.player} in ${worldEntity.world} at ${locationInstance}`,
                );
                players.push(player);
            }
        } catch (error: any) {
            console.warn(error.message);
        }
    }

    return { pois, monsters, items, players };
}
