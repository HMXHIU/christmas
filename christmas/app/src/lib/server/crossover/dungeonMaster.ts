import {
    autoCorrectGeohashPrecision,
    borderingGeohashes,
    calculateLocation,
    childrenGeohashes,
    getPlotsAtGeohash,
} from "$lib/crossover/utils";
import {
    monsterLimitAtGeohash,
    monsterStats,
} from "$lib/crossover/world/bestiary";
import { bestiary } from "$lib/crossover/world/settings/bestiary";
import { compendium } from "$lib/crossover/world/settings/compendium";
import { worldSeed } from "$lib/crossover/world/settings/world";
import type { GeohashLocationType } from "$lib/crossover/world/types";
import { geohashLocationTypes } from "$lib/crossover/world/types";
import { groupBy } from "lodash-es";
import {
    itemRepository,
    monsterRepository,
    monstersInGeohashQuerySet,
    worldRepository,
} from "./redis";
import type {
    ItemEntity,
    MonsterEntity,
    PlayerEntity,
    WorldEntity,
} from "./redis/entities";
import { isLocationTraversable, parseItemVariables } from "./utils";

export { spawnItem, spawnMonster, spawnMonsters, spawnWorld };

/**
 * Spawns monsters in the game world based on the given players' locations.
 * @param players - An array of PlayerEntity objects representing the players' locations.
 * @returns A Promise that resolves when all the monsters have been spawned.
 */
async function spawnMonsters(players: PlayerEntity[]) {
    for (const [locationType, ps] of Object.entries(groupBy(players, "locT"))) {
        // Get all parent geohashes (only interested with geohashes 1 level above unit precision)
        const parentGeohashes = ps.map(({ loc }) => {
            return loc[0].slice(0, -1);
        });

        // Get all neighboring geohashes where there are no players
        const uninhabitedGeohashes = await borderingGeohashes(parentGeohashes);

        for (const geohash of uninhabitedGeohashes) {
            // Get monster limit for each uninhabited geohash
            const monsterLimit = await monsterLimitAtGeohash(geohash);

            // Get number of monsters in geohash
            const numMonsters = await monstersInGeohashQuerySet(
                [geohash],
                locationType as GeohashLocationType,
            ).count();

            // Number of monsters to spawn
            const numMonstersToSpawn = monsterLimit - numMonsters;

            if (numMonstersToSpawn <= 0) {
                continue;
            }

            // Select a random set of child geo hashes to spawn monsters
            const childGeohashes = childrenGeohashes(geohash).sort(
                () => Math.random() - 0.5,
            );

            // Spawn monsters
            for (let i = 0; i < numMonstersToSpawn; i++) {
                // Get a random child geohash
                const childGeohash = childGeohashes[i % childGeohashes.length];

                // TODO: use PG to get random beast
                const beast = bestiary.goblin.beast;

                try {
                    const monster = await spawnMonster({
                        geohash: childGeohash,
                        locationType: locationType as GeohashLocationType,
                        beast,
                    });
                } catch (error) {
                    console.log(`Error spawning ${beast}`, error);
                }
            }
        }
    }
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
    beast,
    level,
}: {
    geohash: string;
    locationType: GeohashLocationType;
    beast: string;
    level?: number;
}): Promise<MonsterEntity> {
    // TODO: Calculate level based on geohash and player level in area if not provided
    level ??= 1;

    if (!geohashLocationTypes.has(locationType)) {
        throw new Error("Can only spawn monster on GeohashLocationType");
    }

    // Get monster count
    const count = await monsterRepository.search().count();
    const monsterId = `monster_${beast}${count}`; // must start with monster

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
    if (!(await isLocationTraversable(location, locationType))) {
        throw new Error(`Cannot spawn ${beast} at ${geohash}`);
    }

    // Get monster stats
    const { hp, mp, st, ap } = monsterStats({ level, beast });
    const monster: MonsterEntity = {
        monster: monsterId, // unique monster id
        name: beast,
        beast,
        loc: location,
        locT: locationType,
        lvl: level,
        hp,
        mp,
        st,
        ap,
        apclk: Date.now(),
        buclk: 0,
        buf: [],
        dbuf: [],
        pthclk: 0,
        pthdur: 0,
        pth: [],
        pthst: "",
    };
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
}: {
    geohash: string;
    locationType: GeohashLocationType;
    assetUrl: string;
    tileHeight: number;
    tileWidth: number;
}): Promise<WorldEntity> {
    if (!geohashLocationTypes.has(locationType)) {
        throw new Error("Can only spawn world on GeohashLocationType");
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

    // Get world count
    const count = await worldRepository.search().count();
    const world = `world_${count}`;

    // Create world asset
    const entity: WorldEntity = {
        world,
        url: assetUrl || "",
        loc: plotGeohashes, // TODO: this can be optimized not just at unit precision -1
        locT: locationType,
    };

    // TODO: Check if there is a world at location/type

    return (await worldRepository.save(world, entity)) as WorldEntity;
}

/**
 * Spawns an item with the given geohash and prop.
 *
 * @param geohash - The geohash for the item.
 * @param prop - The prop in the compendium for the item.
 * @param owner - Who owns or can use the item (player | monster | public (default="") | dm).
 * @param configOwner - Who can configure the item (player | monster | public (default="") | dm).
 * @param variables - The variables for the item.
 * @returns A promise that resolves to the spawned item entity.
 */
async function spawnItem({
    geohash,
    locationType,
    prop,
    variables,
    owner,
    configOwner,
}: {
    geohash: string;
    locationType: GeohashLocationType;
    prop: string;
    owner?: string;
    configOwner?: string;
    variables?: Record<string, any>;
}): Promise<ItemEntity> {
    // Owner defaults to public
    owner ??= "";
    configOwner ??= "";

    if (!geohashLocationTypes.has(locationType)) {
        throw new Error("Can only spawn item on GeohashLocationType");
    }

    // Get item count
    const count = await itemRepository.search().count();
    const item = `item_${prop}${count}`;

    // Get prop
    const { defaultName, defaultState, durability, charges, collider } =
        compendium[prop];

    const asset = compendium[prop].asset;
    const width = asset.width ?? 1;
    const height = asset.height ?? 1;
    const precision = asset.precision ?? worldSeed.spatial.unit.precision;

    // Auto correct geohash precision
    if (geohash.length !== precision) {
        geohash = autoCorrectGeohashPrecision(geohash, precision);
    }

    // Calculate location
    const location = calculateLocation(geohash, width, height);

    // Check location for traversability
    if (!(await isLocationTraversable(location, locationType))) {
        throw new Error(`Cannot spawn ${prop} at ${location}`);
    }

    const entity: ItemEntity = {
        item,
        name: defaultName,
        prop,
        loc: location,
        locT: "geohash",
        own: owner,
        cfg: configOwner,
        cld: collider,
        dur: durability,
        chg: charges,
        state: defaultState,
        vars: parseItemVariables(variables || {}, prop),
        dbuf: [],
        buf: [],
    };

    return (await itemRepository.save(item, entity)) as ItemEntity;
}
