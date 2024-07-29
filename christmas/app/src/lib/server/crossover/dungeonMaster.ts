import {
    autoCorrectGeohashPrecision,
    borderingGeohashes,
    calculateLocation,
    childrenGeohashes,
    geohashNeighbour,
    getPlotsAtGeohash,
} from "$lib/crossover/utils";
import {
    abilities,
    hasResourcesForAbility,
} from "$lib/crossover/world/abilities";
import {
    bestiary,
    monsterLimitAtGeohash,
    monsterStats,
    type Beast,
} from "$lib/crossover/world/bestiary";
import { compendium } from "$lib/crossover/world/compendium";
import type { WorldAssetMetadata } from "$lib/crossover/world/types";
import { worldSeed } from "$lib/crossover/world/world";
import { performAbility } from "./abilities";
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

export {
    dungeonMaster,
    performMonsterActions,
    selectMonsterAbility,
    spawnItem,
    spawnMonster,
    spawnMonsters,
    spawnWorld,
};

const dungeonMaster = `dungeonMaster_benjamin`; // used as owner for items, etc owned by the game

/**
 * Selects the best ability for a monster to use against a player.
 * @param monster - The monster entity.
 * @param player - The player entity.
 * @returns The selected ability as a string, or null if no ability is selected.
 */
function selectMonsterAbility(
    monster: MonsterEntity,
    player: PlayerEntity, // TODO: add more intelligence based on player stats
): string | null {
    const beast: Beast = bestiary[monster.beast];

    // TODO: cache this using lru-cache
    const { hp: maxHp } = monsterStats({
        level: monster.lvl,
        beast: monster.beast,
    });

    const { offensive, defensive, neutral, healing } = beast.abilities;

    // Use the highest ap healing ability if monster's hp is less than half
    if (healing.length > 0 && monster.hp < maxHp / 2) {
        const healingAbilities = healing
            .sort((a, b) => {
                return abilities[b].ap - abilities[a].ap;
            })
            .filter((ability) => {
                return hasResourcesForAbility(monster, ability).hasResources;
            });
        if (healingAbilities.length > 0) {
            return healingAbilities[0];
        }
    }

    // Use the highest ap offensive ability
    if (offensive.length > 0) {
        const offensiveAbilities = offensive
            .sort((a, b) => {
                return abilities[b].ap - abilities[a].ap;
            })
            .filter((ability) => {
                return hasResourcesForAbility(monster, ability).hasResources;
            });
        if (offensiveAbilities.length > 0) {
            return offensiveAbilities[0];
        }
    }

    // Use the highest ap defensive ability
    if (defensive.length > 0) {
        const defensiveAbilities = defensive
            .sort((a, b) => {
                return abilities[b].ap - abilities[a].ap;
            })
            .filter((ability) => {
                return hasResourcesForAbility(monster, ability).hasResources;
            });
        if (defensiveAbilities.length > 0) {
            return defensiveAbilities[0];
        }
    }

    // Use the highest ap neutral ability
    if (neutral.length > 0) {
        const neutralAbilities = neutral
            .sort((a, b) => {
                return abilities[b].ap - abilities[a].ap;
            })
            .filter((ability) => {
                return hasResourcesForAbility(monster, ability).hasResources;
            });
        if (neutralAbilities.length > 0) {
            return neutralAbilities[0];
        }
    }

    // Do nothing
    return null;
}

/**
 * Performs monster actions on players.
 *
 * @param players - An array of PlayerEntity objects representing the players.
 * @param monsters - An optional array of MonsterEntity objects representing the monsters. If not provided, monsters will be fetched based on the player's geohash.
 */
async function performMonsterActions(
    players: PlayerEntity[],
    monsters?: MonsterEntity[],
) {
    for (const player of players) {
        // Get monsters in player's geohash
        const monstersNearPlayer =
            monsters ||
            ((await monstersInGeohashQuerySet([
                player.loc[0],
            ]).return.all()) as MonsterEntity[]);

        // Perform monster actions
        for (const monster of monstersNearPlayer) {
            const ability = selectMonsterAbility(monster, player);
            if (ability != null) {
                await performAbility({
                    self: monster,
                    target: player.player,
                    ability,
                });
            }
        }
    }
}

/**
 * Spawns monsters in the game world based on the given players' locations.
 * @param players - An array of PlayerEntity objects representing the players' locations.
 * @returns A Promise that resolves when all the monsters have been spawned.
 */
async function spawnMonsters(players: PlayerEntity[]) {
    // Get all parent geohashes (only interested with geohashes 1 level above unit precision)
    const parentGeohashes = players
        .map(({ loc }) => {
            return loc[0].slice(0, -1);
        })
        .filter(
            (geohash) =>
                geohash.length === worldSeed.spatial.unit.precision - 1,
        );

    // Get all neighboring geohashes where there are no players
    const uninhabitedGeohashes = await borderingGeohashes(parentGeohashes);

    for (const geohash of uninhabitedGeohashes) {
        // Get monster limit for each uninhabited geohash
        const monsterLimit = await monsterLimitAtGeohash(geohash);

        // Get number of monsters in geohash
        const numMonsters = await monstersInGeohashQuerySet([geohash]).count();

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
                    beast,
                });
            } catch (error) {
                console.log(`Error spawning ${beast}`, error);
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
    beast,
    level,
}: {
    geohash: string;
    beast: string;
    level?: number;
}): Promise<MonsterEntity> {
    // TODO: Calculate level based on geohash and player level in area if not provided
    level ??= 1;

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
    if (!(await isLocationTraversable(location))) {
        throw new Error(`Cannot spawn ${beast} at ${geohash}`);
    }

    // Get monster stats
    const { hp, mp, st, ap } = monsterStats({ level, beast });
    const monster: MonsterEntity = {
        monster: monsterId, // unique monster id
        name: beast,
        beast,
        loc: location,
        locT: "geohash",
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
 * @param asset - The world asset object.
 * @param tileHeight - The height of a tile in game (asset tileheight might be different).
 * @param tileWidth - The width of a tile in game (asset tilewidth might be different).
 * @returns A promise that resolves to a WorldEntity.
 */
async function spawnWorld({
    geohash,
    assetUrl,
    asset,
    tileHeight,
    tileWidth,
}: {
    geohash: string;
    assetUrl?: string;
    asset?: WorldAssetMetadata;
    tileHeight: number;
    tileWidth: number;
}): Promise<WorldEntity> {
    // Check asset or assetUrl
    if (!asset && !assetUrl) {
        throw new Error("asset or assetUrl must be provided");
    }

    // Auto correct geohash to unit precision
    if (geohash.length !== worldSeed.spatial.unit.precision) {
        geohash = autoCorrectGeohashPrecision(
            geohash,
            worldSeed.spatial.unit.precision,
        );
    }

    // Get the origin cell of the plot
    geohash = childrenGeohashes(geohash.slice(0, -1))[0];

    // Get asset from URL or if provided
    asset ??= await (await fetch(assetUrl!)).json();
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

    // Get colliders
    let colliders = [];
    for (const { data, properties, width, height } of layers) {
        if (properties == null) {
            continue;
        }
        for (const { name, value } of properties) {
            if (name === "collider" && value === true) {
                // Outer row
                let geohashRow = geohash;
                for (let i = 0; i < height; i++) {
                    // Outer col
                    let geohashCol = geohashRow;
                    for (let j = 0; j < width; j++) {
                        if (data[i * width + j] !== 0) {
                            // Inner row
                            let geohashRowInner = geohashCol;
                            for (let m = 0; m < heightMultiplier; m++) {
                                // Inner col
                                let geohashColInner = geohashRowInner;
                                for (let n = 0; n < widthMultiplier; n++) {
                                    colliders.push(geohashColInner); // add collider
                                    geohashColInner = geohashNeighbour(
                                        geohashColInner,
                                        "e",
                                    );
                                }
                                geohashRowInner = geohashNeighbour(
                                    geohashRowInner,
                                    "s",
                                );
                            }
                        }
                        geohashCol = geohashNeighbour(
                            geohashCol,
                            "e",
                            widthMultiplier,
                        );
                    }
                    geohashRow = geohashNeighbour(
                        geohashRow,
                        "s",
                        heightMultiplier,
                    );
                }
            }
        }
    }

    // Get world count
    const count = await worldRepository.search().count();
    const world = `world_${count}`;

    // Create world asset
    const entity: WorldEntity = {
        world,
        url: assetUrl || "",
        loc: plotGeohashes, // TODO: this can be optimized not just at unit precision -1
        h: height,
        w: width,
        cld: colliders,
    };

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
    prop,
    variables,
    owner,
    configOwner,
}: {
    geohash: string;
    prop: string;
    owner?: string;
    configOwner?: string;
    variables?: Record<string, any>;
}): Promise<ItemEntity> {
    // Owner defaults to public
    owner ??= "";
    configOwner ??= "";

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
    if (!(await isLocationTraversable(location))) {
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
