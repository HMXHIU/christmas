import {
    type GameRedisEntities,
    type Item,
    type ItemEntity,
    type Monster,
    type MonsterEntity,
    type Player,
    type PlayerEntity,
} from "$lib/crossover/types";
import {
    expandGeohashes,
    geohashesNearby,
    getEntityId,
} from "$lib/crossover/utils";
import { compendium } from "$lib/crossover/world/settings/compendium";
import { worldSeed } from "$lib/crossover/world/settings/world";
import type {
    EquipmentSlot,
    GeohashLocationType,
} from "$lib/crossover/world/types";
import { EquipmentSlots, WeaponSlots } from "$lib/crossover/world/types";
import { uniq } from "lodash-es";
import type { Search } from "redis-om";
import {
    itemRepository,
    monsterRepository,
    playerRepository,
    worldRepository,
} from ".";
import { LOOK_PAGE_SIZE } from "..";

// Exports
export {
    dungeonEntrancesQuerySet,
    equipmentQuerySet,
    equippedWeapons,
    getNearbyEntities,
    getNearbyPlayerIds,
    getPlayerIdsNearbyEntities,
    hasCollidersInGeohash,
    inventoryQuerySet,
    isGeohashInWorld,
    itemsInGeohashQuerySet,
    loggedInPlayersQuerySet,
    monstersInGeohashQuerySet,
    playersInGeohashQuerySet,
    worldsContainingGeohashQuerySet,
    worldsInGeohashQuerySet,
    writsQuerySet,
};

/**
 * Retrieves nearby entities based on the provided geohash and page size.
 *
 * @param geohash - The geohash used to determine nearby entities.
 * @param playersPageSize - The page size for retrieving players.
 * @returns A promise that resolves to an object containing players, monsters, and items.
 */
async function getNearbyEntities(
    geohash: string,
    locationType: GeohashLocationType,
    locationInstance: string,
    playersPageSize: number,
    options: {
        monsters: boolean;
        items: boolean;
        players: boolean;
    } = { monsters: true, items: true, players: true },
): Promise<{
    players: Player[];
    monsters: Monster[];
    items: Item[];
}> {
    // Get nearby geohashes
    const p6 = geohash.slice(0, -2);
    const nearbyGeohashes = geohashesNearby(p6);

    return {
        players: options.players
            ? ((await playersInGeohashQuerySet(
                  nearbyGeohashes,
                  locationType,
                  locationInstance,
              ).return.all({
                  pageSize: playersPageSize,
              })) as PlayerEntity[])
            : [],
        monsters: options.monsters
            ? ((await monstersInGeohashQuerySet(
                  nearbyGeohashes, // no pageSize for monsters, retrive everything
                  locationType,
                  locationInstance,
              ).return.all()) as MonsterEntity[])
            : [],
        items: options.items
            ? ((await itemsInGeohashQuerySet(
                  nearbyGeohashes, // no pageSize for monsters, retrive everything
                  locationType,
                  locationInstance,
              ).return.all()) as ItemEntity[])
            : [],
    };
}

async function getNearbyPlayerIds(
    geohash: string,
    locationType: GeohashLocationType,
    locationInstance: string,
): Promise<string[]> {
    const { players } = await getNearbyEntities(
        geohash,
        locationType,
        locationInstance,
        LOOK_PAGE_SIZE,
        {
            players: true,
            monsters: false,
            items: false,
        },
    );
    return players.map((p) => p.player);
}

async function getPlayerIdsNearbyEntities(
    ...entities: GameRedisEntities[]
): Promise<string[]> {
    return uniq(
        (
            await Promise.all(
                uniq(entities).map((entity) =>
                    getNearbyPlayerIds(
                        entity.loc[0],
                        entity.locT as GeohashLocationType,
                        entity.locI,
                    ),
                ),
            )
        ).flat(),
    );
}

async function hasCollidersInGeohash(
    geohash: string,
    locationType: GeohashLocationType,
    locationInstance: string,
): Promise<boolean> {
    return (
        (await itemsInGeohashQuerySet([geohash], locationType, locationInstance)
            .and("cld")
            .equal(true)
            .count()) > 0
    );
}

async function isGeohashInWorld(
    geohash: string,
    locationType: GeohashLocationType,
): Promise<boolean> {
    return (
        (await worldsContainingGeohashQuerySet(
            [geohash],
            locationType,
        ).count()) > 0
    );
}

/*
 * QuerySets
 */

/**
 * Returns a search query set for logged in players.
 * @returns A search query set for logged in players.
 */
function loggedInPlayersQuerySet(): Search {
    return playerRepository.search().where("lgn").equal(true);
}

/**
 * Returns a search query set for players in a specific geohash.
 * @param geohashes The geohashes to filter players by.
 * @returns A search query set for players in the specified geohash.
 */
function playersInGeohashQuerySet(
    geohashes: string[],
    locationType: GeohashLocationType,
    locationInstance: string,
): Search {
    return loggedInPlayersQuerySet()
        .where("locT")
        .equal(locationType)
        .and("locI")
        .equal(locationInstance)
        .and("loc")
        .containOneOf(...geohashes.map((x) => `${x}*`));
}

/**
 * Returns a search query set for monsters in a specific geohash.
 * @param geohashes The geohashes to filter monsters by.
 * @returns A search query set for monsters in the specified geohash.
 */
function monstersInGeohashQuerySet(
    geohashes: string[],
    locationType: GeohashLocationType,
    locationInstance: string,
): Search {
    return monsterRepository
        .search()
        .where("locT")
        .equal(locationType)
        .and("locI")
        .equal(locationInstance)
        .and("loc")
        .containOneOf(...geohashes.map((x) => `${x}*`));
}

/**
 * Retrieves items in a geohash query set.
 * @param geohashes - The geohashes to search for items in.
 * @returns A Search object representing the query.
 */
function itemsInGeohashQuerySet(
    geohashes: string[],
    locationType: GeohashLocationType,
    locationInstance: string,
): Search {
    return itemRepository
        .search()
        .where("locT")
        .equal(locationType)
        .and("locI")
        .equal(locationInstance)
        .and("loc")
        .containOneOf(...geohashes.map((x) => `${x}*`));
}

/**
 * Retrieves worlds if the geohash is inside the world
 * Note: This is not the same as `worldsInGeohashQuerySet` in which the world is inside the geohash
 * @param geohashes - The geohashes to search for worlds in.
 * @param precision - The precision level of the geohashes (defaults to town).
 * @returns A Search object representing the query.
 */
function worldsContainingGeohashQuerySet(
    geohashes: string[],
    locationType: GeohashLocationType,
    precision?: number,
): Search {
    precision ??= worldSeed.spatial.town.precision;
    return worldRepository
        .search()
        .where("locT")
        .equal(locationType)
        .and("loc")
        .containOneOf(...expandGeohashes(geohashes, precision));
}

/**
 * Retrieves worlds in a geohash query set.
 * @param geohashes - The geohashes to search for worlds in.
 * @returns A Search object representing the query.
 */
function worldsInGeohashQuerySet(
    geohashes: string[],
    locationType: GeohashLocationType,
): Search {
    return worldRepository
        .search()
        .where("locT")
        .equal(locationType)
        .and("loc")
        .containOneOf(...geohashes.map((x) => `${x}*`));
}

/**
 * Retrieves the inventory items for a specific player.
 * @param player - The name of the player.
 * @returns A Search object representing the query for player inventory items.
 */
function inventoryQuerySet(player: string): Search {
    return itemRepository.search().where("loc").contains(player);
}

function writsQuerySet(player: string): Search {
    return inventoryQuerySet(player)
        .and("prop")
        .equal(compendium.tradewrit.prop);
}

/**
 * Retrieves the equipped items for a specific player.
 * @param player - The name of the player.
 * @returns A Search object representing the query for player inventory items.
 */
function equipmentQuerySet(
    player: string,
    equipmentSlots?: EquipmentSlot[],
): Search {
    equipmentSlots = equipmentSlots ?? EquipmentSlots;
    let qs = itemRepository.search().where("loc").contains(player);
    qs = qs.and("locT").equal(equipmentSlots[0]);
    for (let i = 1; i < equipmentSlots.length; i++) {
        qs = qs.or("locT").equalTo(equipmentSlots[i]);
    }
    return qs;
}

function dungeonEntrancesQuerySet(
    territory: string,
    locationType: GeohashLocationType,
): Search {
    return itemRepository
        .search()
        .where("prop")
        .equal(compendium.dungeonentrance.prop)
        .and("locT")
        .equal(locationType)
        .and("loc")
        .containOneOf(`${territory}*`);
}

async function equippedWeapons(
    entity: PlayerEntity | MonsterEntity,
): Promise<ItemEntity[]> {
    let weapons = (await equipmentQuerySet(
        getEntityId(entity)[0],
        WeaponSlots,
    ).returnAll()) as ItemEntity[];
    weapons = weapons.filter((i) => compendium[i.prop].dieRoll); // remove shields etc ..
    return weapons;
}
