import { type Item, type Monster, type Player } from "$lib/crossover/types";
import {
    expandGeohashes,
    geohashesNearby,
    getEntityId,
} from "$lib/crossover/utils";
import { DUNGEON_PRECISION } from "$lib/crossover/world/dungeons";
import { LOCATION_INSTANCE } from "$lib/crossover/world/settings";
import { compendium } from "$lib/crossover/world/settings/compendium";
import { worldSeed } from "$lib/crossover/world/settings/world";
import type {
    EquipmentSlot,
    GeohashLocation,
} from "$lib/crossover/world/types";
import { equipmentSlots, weaponSlots } from "$lib/crossover/world/types";
import {
    findClosestSanctuary,
    type Sanctuary,
} from "$lib/crossover/world/world";
import {
    type ActorEntity,
    type CreatureEntity,
    type ItemEntity,
    type MonsterEntity,
    type PlayerEntity,
} from "$lib/server/crossover/types";
import { uniq } from "lodash-es";
import type { RawSearch, Search } from "redis-om";
import {
    itemRepository,
    monsterRepository,
    playerRepository,
    questRepository,
    worldRepository,
} from ".";
import { LOOK_PAGE_SIZE } from "..";
import { factionInControl } from "../actions/capture";
import type { NPCs } from "../npc/types";
import type { QuestEntity } from "../quests/types";

// Exports
export {
    chainOr,
    closestSanctuaryMonument,
    controlMonumentsQuerySet,
    dungeonEntrancesQuerySet,
    equipmentQuerySet,
    equippedWeapons,
    getNearbyEntities,
    getNearbyPlayerIds,
    getPlayerIdsNearbyEntities,
    hasCollidersAtLocation,
    inventoryQuerySet,
    itemsInGeohashQuerySet,
    loggedInPlayersQuerySet,
    monstersInGeohashQuerySet,
    npcsNotInLimboQuerySet,
    playerQuestsInvolvingEntities,
    playersInGeohashQuerySet,
    questWritsQuerySet,
    relevantQuestsQuerySet,
    tradeWritsQuerySet,
    worldsContainingGeohashQuerySet,
    worldsInGeohashQuerySet,
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
    locationType: GeohashLocation,
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

    // Get entities in the vincinity of geohash
    const entities = {
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

    /* 
    When locationType=in we need to return the item that the entity is "in" (for the MUD description)
    But do not draw it on the client as the locationInstance is not the same
    */
    if (options.items && locationType === "in") {
        const inItem = (await itemRepository.fetch(
            locationInstance,
        )) as ItemEntity;
        if (inItem) {
            entities.items.push(inItem);
        }
    }

    return entities;
}

async function getNearbyPlayerIds(
    geohash: string,
    locationType: GeohashLocation,
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
    ...entities: ActorEntity[]
): Promise<string[]> {
    return uniq(
        (
            await Promise.all(
                uniq(entities).map((entity) =>
                    getNearbyPlayerIds(
                        entity.loc[0],
                        entity.locT as GeohashLocation,
                        entity.locI,
                    ),
                ),
            )
        ).flat(),
    );
}

async function hasCollidersAtLocation(
    geohash: string,
    locationType: GeohashLocation,
    locationInstance: string,
): Promise<boolean> {
    return (
        (await itemsInGeohashQuerySet([geohash], locationType, locationInstance)
            .and("cld")
            .equal(true)
            .count()) > 0
    );
}

/*
 * QuerySets
 */

/**
 * Returns a search query set for logged in players.
 *
 * @returns A search query set for logged in players.
 */
function loggedInPlayersQuerySet(): Search {
    return playerRepository.search().where("lgn").equal(true);
}

/**
 * Returns a search query set for players in a specific geohash.
 *
 * @param geohashes The geohashes to filter players by.
 * @returns A search query set for players in the specified geohash.
 */
function playersInGeohashQuerySet(
    geohashes: string[],
    locationType: GeohashLocation,
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

function npcsNotInLimboQuerySet(npc: NPCs): Search {
    return playerRepository
        .search()
        .where("npc")
        .equal(`${npc}*`)
        .and("locT")
        .not.equal("limbo");
}

/**
 * Returns a search query set for monsters in a specific geohash.
 *
 * @param geohashes The geohashes to filter monsters by.
 * @returns A search query set for monsters in the specified geohash.
 */
function monstersInGeohashQuerySet(
    geohashes: string[],
    locationType: GeohashLocation,
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
 *
 * @param geohashes - The geohashes to search for items in.
 * @returns A Search object representing the query.
 */
function itemsInGeohashQuerySet(
    geohashes: string[],
    locationType: GeohashLocation,
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
 *
 * @param geohashes - The geohashes to search for worlds in.
 * @param precision - The precision level of the geohashes (defaults to town).
 * @returns A Search object representing the query.
 */
function worldsContainingGeohashQuerySet(
    geohashes: string[],
    locationType: GeohashLocation,
    locationInstance: string,
    precision?: number,
): Search {
    precision ??= worldSeed.spatial.town.precision;
    return worldRepository
        .search()
        .where("locT")
        .equal(locationType)
        .and("locI")
        .equal(locationInstance)
        .and("loc")
        .containOneOf(...expandGeohashes(geohashes, precision));
}

/**
 * Retrieves worlds in a geohash query set.
 *
 * @param geohashes - The geohashes to search for worlds in.
 * @returns A Search object representing the query.
 */
function worldsInGeohashQuerySet(
    geohashes: string[],
    locationType: GeohashLocation,
    locationInstance: string,
): Search {
    return worldRepository
        .search()
        .where("locT")
        .equal(locationType)
        .and("locI")
        .equal(locationInstance)
        .and("loc")
        .containOneOf(...geohashes.map((x) => `${x}*`));
}

/**
 * Retrieves the inventory items for a specific player.
 *
 * @param player - The name of the player.
 * @returns A Search object representing the query for player inventory items.
 */
function inventoryQuerySet(player: string): Search {
    return itemRepository.search().where("loc").contains(player);
}

function tradeWritsQuerySet(player: string): Search {
    return inventoryQuerySet(player)
        .and("prop")
        .equal(compendium.tradewrit.prop);
}

function questWritsQuerySet(player: string): Search {
    return inventoryQuerySet(player)
        .and("prop")
        .equal(compendium.questwrit.prop);
}

function relevantQuestsQuerySet(
    quests: string[],
    entities: string[],
): Search | RawSearch {
    if (quests.length < 1) {
        throw new Error("Must have at least 1 quest to search");
    }
    return questRepository.searchRaw(
        `@fulfilled:{false} @quest:{${quests.join("|")}} @entityIds:{${entities.join("|")}}`,
    );
}

function chainOr(
    qs: Search<Record<string, any>>,
    field: string,
    contains: string[],
): Search<Record<string, any>> {
    // Note: This can't be grouped (eg. A & (B|C|D)), it is better to use raw search
    qs = qs.where(field).equal(contains[0]);
    for (let i = 1; i < contains.length; i++) {
        qs = qs.or(field).equalTo(contains[i]);
    }
    return qs;
}

async function playerQuestsInvolvingEntities(
    player: string,
    entities: string[],
): Promise<[QuestEntity, ItemEntity][]> {
    // Get quest writs
    const writs = (await questWritsQuerySet(
        player,
    ).returnAll()) as ItemEntity[];
    if (writs.length < 1) {
        return [];
    }

    const questIds = writs
        .map((qw) => qw.vars.quest as string)
        .filter((q) => q);
    if (questIds.length < 1) {
        return [];
    }

    // Get quests from writs
    const quests = (await relevantQuestsQuerySet(
        questIds,
        entities,
    ).returnAll()) as QuestEntity[];

    return quests.map((q) => [
        q,
        writs.find((qw) => qw.vars.quest === q.quest)!,
    ]);
}

/**
 * Retrieves the equipped items for a specific player.
 * @param player - The name of the player.
 * @returns A Search object representing the query for player inventory items.
 */
function equipmentQuerySet(
    player: string,
    equipment?: EquipmentSlot[],
): Search | RawSearch {
    equipment = equipment ?? Array.from(equipmentSlots);
    return itemRepository.searchRaw(
        `@loc:{${player}} @locT:{${equipment.join("|")}}`,
    );
}

function dungeonEntrancesQuerySet(
    territory: string,
    locationType: GeohashLocation,
    locationInstance: string,
): Search {
    return itemRepository
        .search()
        .where("prop")
        .equal(compendium.dungeonentrance.prop)
        .and("locT")
        .equal(locationType)
        .and("locI")
        .equal(locationInstance)
        .and("loc")
        .containOneOf(`${territory}*`);
}

function controlMonumentsQuerySet(
    geohash: string,
    locationType: GeohashLocation,
    locationInstance: string,
): Search {
    return itemRepository
        .search()
        .where("prop")
        .equal(compendium.control.prop)
        .and("locT")
        .equal(locationType)
        .and("locI")
        .equal(locationInstance)
        .and("loc")
        .containOneOf(`${geohash}*`);
}

async function closestSanctuaryMonument(
    creature: CreatureEntity,
): Promise<[Sanctuary, ItemEntity | undefined]> {
    const sanctuary = await findClosestSanctuary(creature.loc[0]);
    const monuments = (await controlMonumentsQuerySet(
        sanctuary.geohash.slice(0, DUNGEON_PRECISION),
        "d1", // sancturaries are in the `d1`
        LOCATION_INSTANCE,
    ).returnAll()) as ItemEntity[];
    return [
        sanctuary,
        monuments.find((m) => factionInControl(m) === creature.fac),
    ];
}

async function equippedWeapons(entity: CreatureEntity): Promise<ItemEntity[]> {
    let weapons = (await equipmentQuerySet(
        getEntityId(entity)[0],
        Array.from(weaponSlots),
    ).returnAll()) as ItemEntity[];
    return weapons.filter((i) => compendium[i.prop].dieRoll); // remove shields etc ...
}
