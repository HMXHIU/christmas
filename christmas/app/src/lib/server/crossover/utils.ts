import { ENVIRONMENT } from "$env/static/private";
import type { Monster, Player } from "$lib/crossover/types";
import { entityInRange, geohashNeighbour } from "$lib/crossover/utils";
import { type ItemVariables } from "$lib/crossover/world/compendium";
import { compendium } from "$lib/crossover/world/settings/compendium";
import type {
    Direction,
    EquipmentSlot,
    GeohashLocationType,
} from "$lib/crossover/world/types";
import { isGeohashTraversable } from "$lib/crossover/world/utils";
import {
    biomeAtGeohashCache,
    biomeParametersAtCityCache,
    dungeonGraphCache,
    topologyBufferCache,
    topologyResponseCache,
    topologyResultCache,
    worldAssetMetadataCache,
    worldTraversableCellsCache,
} from "$lib/server/crossover/caches";
import type {
    ItemEntity,
    MonsterEntity,
    PlayerEntity,
    WorldEntity,
} from "$lib/server/crossover/types";
import { parseZodErrors } from "$lib/utils";
import { PublicKey } from "@solana/web3.js";
import { z } from "zod";
import { PlayerStateSchema, type PlayerState } from ".";
import { serverAnchorClient } from "..";
import { ObjectStorage } from "../objectStorage";
import { itemRepository, monsterRepository, playerRepository } from "./redis";
import {
    hasCollidersInGeohash,
    worldsContainingGeohashQuerySet,
} from "./redis/queries";
import type { UserMetadataSchema } from "./router";

export {
    canConfigureItem,
    canUseItem,
    entityIsBusy,
    getPlayerState,
    getUserMetadata,
    hasItemConfigOwnerPermissions,
    hasItemOwnerPermissions,
    isDirectionTraversable,
    isGeohashTraversableServer,
    isLocationTraversable,
    itemVariableValue,
    parseItemVariables,
    random,
    savePlayerState,
    setPlayerState,
};

function entityIsBusy(entity: Player | Monster): [boolean, number] {
    const now = Date.now();
    if (entity.buclk > now) {
        return [true, now];
    }
    return [false, now];
}

async function getWorldAtGeohash(
    geohash: string,
    locationType: GeohashLocationType,
): Promise<WorldEntity | undefined> {
    return (await worldsContainingGeohashQuerySet(
        [geohash],
        locationType,
    ).first()) as WorldEntity | undefined;
}

async function isGeohashTraversableServer(
    geohash: string,
    locationType: GeohashLocationType,
    locationInstance: string,
): Promise<boolean> {
    return await isGeohashTraversable(
        geohash,
        locationType,
        locationInstance,
        hasCollidersInGeohash,
        getWorldAtGeohash,
        {
            topologyResultCache,
            topologyBufferCache,
            topologyResponseCache,
            worldTraversableCellsCache,
            worldAssetMetadataCache,
            biomeAtGeohashCache,
            biomeParametersAtCityCache,
            dungeonGraphCache,
        },
    );
}

async function isLocationTraversable(
    location: string[],
    locationType: GeohashLocationType,
    locationInstance: string,
): Promise<boolean> {
    for (const geohash of location) {
        if (
            !(await isGeohashTraversableServer(
                geohash,
                locationType,
                locationInstance,
            ))
        ) {
            return false;
        }
    }
    return true;
}

async function isDirectionTraversable(
    loc: string[], // entity might be more than 1 cell in size
    locationType: GeohashLocationType,
    locationInstance: string,
    direction: Direction,
): Promise<[boolean, string[]]> {
    let location: string[] = [];

    // Check all cells are able to move (location might include more than 1 cell for large entities)
    for (const geohash of loc) {
        const nextGeohash = geohashNeighbour(geohash, direction);

        // Within own location is always traversable
        if (loc.includes(nextGeohash)) {
            location.push(nextGeohash);
            continue;
        }

        // Check if geohash is traversable
        if (
            !(await isGeohashTraversableServer(
                nextGeohash,
                locationType,
                locationInstance,
            ))
        ) {
            return [false, loc]; // early return if not traversable
        } else {
            location.push(nextGeohash);
        }
    }
    return [true, location];
}

/**
 * Retrieves the user metadata for a given public key
 *
 * TODO: this should be cached as it calls the blockchain
 *
 * @param publicKey The public key of the user.
 * @returns A promise that resolves to the user metadata or null if not found.
 * @throws Error if the user account does not exist or is missing metadata URI.
 */
async function getUserMetadata(
    publicKey: string,
): Promise<z.infer<typeof UserMetadataSchema> | null> {
    const user = await serverAnchorClient.getUser(new PublicKey(publicKey));

    if (user == null) {
        throw new Error(`User account ${publicKey} does not exist`);
    }

    if (!user?.uri) {
        throw new Error(`User account ${publicKey} missing metadata uri`);
    }

    // Load metadata
    let response = await fetch(user.uri);
    const userMetadata: z.infer<typeof UserMetadataSchema> =
        await response.json();

    return userMetadata || null;
}

/**
 * Retrieves the player state for a given public key.
 *
 * @param publicKey The public key of the player.
 * @returns A promise that resolves to the player state or null if not found.
 */
async function getPlayerState(publicKey: string): Promise<PlayerState | null> {
    try {
        return await ObjectStorage.getJSONObject({
            owner: publicKey,
            bucket: "player",
            name: publicKey,
        });
    } catch (error: any) {
        return null;
    }
}

/**
 * Sets the player state for a given public key.
 *
 * @param publicKey The public key of the player.
 * @param state The player state to set.
 * @returns A promise that resolves to a string indicating the success of the operation.
 * @throws Error if there is an error parsing the player state.
 */
async function setPlayerState(
    publicKey: string,
    state: PlayerState,
): Promise<string> {
    try {
        return await ObjectStorage.putJSONObject({
            owner: publicKey,
            bucket: "player",
            name: publicKey,
            data: PlayerStateSchema.parse(state),
        });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            throw new Error(JSON.stringify(parseZodErrors(error)));
        } else {
            throw error;
        }
    }
}

/**
 * Saves the player state (into s3) for a given public key.
 *
 * @param publicKey The public key of the player.
 * @returns A promise that resolves to a string indicating the success of the operation.
 */
async function savePlayerState(publicKey: string): Promise<string> {
    return await setPlayerState(
        publicKey,
        (await playerRepository.fetch(publicKey)) as PlayerState,
    );
}

function hasItemOwnerPermissions(
    item: ItemEntity,
    self: PlayerEntity | MonsterEntity,
) {
    return (
        item.own === "" || item.own === self.player || item.own === self.monster
    );
}

function hasItemConfigOwnerPermissions(
    item: ItemEntity,
    self: PlayerEntity | MonsterEntity,
) {
    return (
        item.cfg === "" || item.cfg === self.player || item.cfg === self.monster
    );
}

function canConfigureItem(
    self: PlayerEntity | MonsterEntity,
    item: ItemEntity,
): { canConfigure: boolean; message: string } {
    // Check valid prop
    if (!compendium.hasOwnProperty(item.prop)) {
        return {
            canConfigure: false,
            message: `${item.prop} not found in compendium`,
        };
    }

    // Check if have permissions to configure item
    if (!hasItemConfigOwnerPermissions(item, self)) {
        return {
            canConfigure: false,
            message: `${self.player || self.monster} does not own ${item.item}`,
        };
    }

    return {
        canConfigure: true,
        message: "",
    };
}

function canUseItem(
    self: PlayerEntity | MonsterEntity,
    item: ItemEntity,
    utility: string,
): { canUse: boolean; message: string } {
    // Check valid prop
    if (!compendium.hasOwnProperty(item.prop)) {
        return {
            canUse: false,
            message: `${item.prop} not found in compendium`,
        };
    }
    const prop = compendium[item.prop];

    // Check valid utility
    if (!(prop.utilities && prop.utilities[utility])) {
        return {
            canUse: false,
            message: `Invalid utility ${utility} for item ${item.item}`,
        };
    }
    const propUtility = prop.utilities[utility];

    // Check item in range
    if (propUtility.range != null) {
        if (!entityInRange(self, item, propUtility.range)[0]) {
            return {
                canUse: false,
                message: `${item.name} is out of range`,
            };
        }
    }

    // Check if have permissions to use item
    if (!hasItemOwnerPermissions(item, self)) {
        return {
            canUse: false,
            message: `${self.player || self.monster} does not own ${item.item}`,
        };
    }

    // Check if utility requires item to be equipped and is equipped in the correct slot
    if (
        prop.utilities[utility].requireEquipped &&
        !compendium[item.prop].equipmentSlot!.includes(
            item.locT as EquipmentSlot,
        )
    ) {
        return {
            canUse: false,
            message: `${item.item} is not equipped in the required slot`,
        };
    }

    // Check has enough charges or durability

    if (item.chg < propUtility.cost.charges) {
        return {
            canUse: false,
            message: `${item.item} has not enough charges to perform ${utility}`,
        };
    }
    if (item.dur < propUtility.cost.durability) {
        return {
            canUse: false,
            message: `${item.item} has not enough durability to perform ${utility}`,
        };
    }

    return {
        canUse: true,
        message: "",
    };
}

function parseItemVariables(
    variables: ItemVariables,
    prop: string,
): ItemVariables {
    const propVariables = compendium[prop].variables;
    let itemVariables: ItemVariables = {};

    for (const [key, value] of Object.entries(variables)) {
        if (propVariables.hasOwnProperty(key)) {
            const { type } = propVariables[key];
            if (["string", "item", "monster", "player"].includes(type)) {
                itemVariables[key] = String(value);
            } else if (type === "number") {
                itemVariables[key] = Number(value);
            } else if (type === "boolean") {
                itemVariables[key] = Boolean(value);
            }
        }
    }

    return itemVariables;
}

async function itemVariableValue(
    item: ItemEntity,
    key: string,
): Promise<
    string | number | boolean | PlayerEntity | MonsterEntity | ItemEntity
> {
    const itemVariables = item.vars;
    const propVariables = compendium[item.prop].variables;
    const { type } = propVariables[key];
    const variable = itemVariables[key];

    if (type === "item") {
        return (await itemRepository.fetch(variable as string)) as ItemEntity;
    } else if (type === "player") {
        return (await playerRepository.fetch(
            variable as string,
        )) as PlayerEntity;
    } else if (type === "monster") {
        return (await monsterRepository.fetch(
            variable as string,
        )) as MonsterEntity;
    } else if (type === "string") {
        return String(variable);
    } else if (type === "number") {
        return Number(variable);
    } else if (type === "boolean") {
        return Boolean(variable);
    }

    throw new Error(`Invalid variable type ${type} for item ${item.item}`);
}

function random() {
    if (ENVIRONMENT === "development") {
        return 0.5;
    }
    return Math.random();
}
