import { childrenGeohashes, worldSeed } from "$lib/crossover/world";
import { monsterStats } from "$lib/crossover/world/bestiary";
import { playerStats } from "$lib/crossover/world/player";
import { serverAnchorClient } from "$lib/server";
import { parseZodErrors } from "$lib/utils";
import { PublicKey } from "@solana/web3.js";
import type { Search } from "redis-om";
import { z } from "zod";
import { ObjectStorage } from "../objectStorage";
import { monsterRepository, playerRepository } from "./redis";
import { type MonsterEntity, type PlayerEntity } from "./redis/entities";
import {
    PlayerStateSchema,
    type PlayerMetadataSchema,
    type UserMetadataSchema,
} from "./router";

export {
    connectedUsers,
    getLoadedPlayerEntity,
    getPlayerMetadata,
    getUserMetadata,
    initPlayerEntity,
    loadPlayerEntity,
    loggedInPlayersQuerySet,
    monstersInGeohashQuerySet,
    playersInGeohashQuerySet,
    savePlayerEntityState,
    spawnMonster,
    type ConnectedUser,
};

/**
 * Interface representing a connected user.
 */
interface ConnectedUser {
    publicKey: string;
    controller: ReadableStreamDefaultController<any>;
}

/**
 * Record of connected users on this server instance.
 */
let connectedUsers: Record<string, ConnectedUser> = {};

/**
 * Retrieves the user metadata for a given public key.
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
 * Retrieves the player metadata for a given public key.
 * @param publicKey The public key of the player.
 * @returns A promise that resolves to the player metadata or null if not found.
 */
async function getPlayerMetadata(
    publicKey: string,
): Promise<z.infer<typeof PlayerMetadataSchema> | null> {
    return (await getUserMetadata(publicKey))?.crossover || null;
}

/**
 * Retrieves the player state for a given public key.
 * @param publicKey The public key of the player.
 * @returns A promise that resolves to the player state or null if not found.
 */
async function getPlayerState(
    publicKey: string,
): Promise<z.infer<typeof PlayerStateSchema> | null> {
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
 * @param publicKey The public key of the player.
 * @param state The player state to set.
 * @returns A promise that resolves to a string indicating the success of the operation.
 * @throws Error if there is an error parsing the player state.
 */
async function setPlayerState(
    publicKey: string,
    state: z.infer<typeof PlayerStateSchema>,
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
 * Retrieves the loaded player entity for a given public key.
 * @param publicKey The public key of the player.
 * @returns A promise that resolves to the loaded player entity or null if not found.
 */
async function getLoadedPlayerEntity(
    publicKey: string,
): Promise<PlayerEntity | null> {
    const player = (await playerRepository.fetch(publicKey)) as PlayerEntity;
    return player.player ? player : null;
}

/**
 * Loads the player entity (PlayerMetadata + PlayerState) for a given public key.
 * @param publicKey The public key of the player.
 * @param playerState Upsert player state if provided.
 * @returns A promise that resolves to the loaded player entity.
 * @throws Error if the player is not found.
 */
async function loadPlayerEntity(
    publicKey: string,
    playerState: any = {},
): Promise<PlayerEntity> {
    // Get player metadata
    const playerMetadata = await getPlayerMetadata(publicKey);
    if (playerMetadata == null) {
        throw new Error(`Player ${publicKey} not found`);
    }

    // Get & update player state
    const newPlayerState = {
        ...((await getPlayerState(publicKey)) || {}),
        ...playerState,
    };
    await setPlayerState(publicKey, newPlayerState);

    return (await playerRepository.save(publicKey, {
        ...playerMetadata,
        ...newPlayerState,
    })) as PlayerEntity;
}

/**
 * Initializes the player entity.
 * @param player The player entity.
 * @param region The region of the player.
 * @param geohash The geohash of the player.
 * @param forceSave Indicates whether to force save the player entity.
 * @returns A promise that resolves to the initialized player entity.
 */
async function initPlayerEntity(
    {
        player,
        region,
        geohash,
    }: {
        player: PlayerEntity;
        region: string;
        geohash: string;
    },
    { forceSave }: { forceSave: boolean } = { forceSave: false },
): Promise<PlayerEntity> {
    let changed = false;

    // Initialize geohash
    if (!player.geohash) {
        // TODO: Spawn player in region's city center spawn point
        player.geohash = geohash;
        changed = true;
    }

    // Initialize level and stats
    if (!player.level) {
        player.level = 1;
        const { hp, mp, st, ap } = playerStats({ level: player.level });
        player.hp = hp;
        player.mp = mp;
        player.st = st;
        player.ap = ap;
        player.debuffs = [];
        player.buffs = [];
        changed = true;
        console.log("Initialized player's level and stats", player.player);
    }

    // Auto correct player's geohash precision
    if (player.geohash.length !== worldSeed.spatial.unit.precision) {
        const delta = worldSeed.spatial.unit.precision - player.geohash.length;
        let geohash = player.geohash;
        if (delta > 0) {
            for (let i = 0; i < delta; i++) {
                geohash = childrenGeohashes(geohash)[0];
            }
        } else if (delta < 0) {
            geohash = geohash.slice(0, worldSeed.spatial.unit.precision);
        }
        player.geohash = geohash;
        console.log("Auto corrected player's geohash", player.geohash);
    }

    // Save if changed or `forceSave`
    if (changed || forceSave) {
        player = (await playerRepository.save(
            player.player,
            player,
        )) as PlayerEntity;
    }

    return player;
}

/**
 * Saves the player entity state for a given public key.
 * @param publicKey The public key of the player.
 * @returns A promise that resolves to a string indicating the success of the operation.
 */
async function savePlayerEntityState(publicKey: string): Promise<string> {
    return await setPlayerState(
        publicKey,
        (await playerRepository.fetch(publicKey)) as PlayerEntity,
    );
}

/**
 * Returns a search query set for logged in players.
 * @returns A search query set for logged in players.
 */
function loggedInPlayersQuerySet(): Search {
    return playerRepository.search().where("loggedIn").equal(true);
}

/**
 * Returns a search query set for players in a specific geohash.
 * @param geohash The geohash to filter players by.
 * @returns A search query set for players in the specified geohash.
 */
function playersInGeohashQuerySet(geohash: string): Search {
    // TODO: this should include all children geohashes
    return loggedInPlayersQuerySet().and("geohash").equal(geohash);
}

/**
 * Returns a search query set for monsters in a specific geohash.
 * @param geohash The geohash to filter monsters by.
 * @returns A search query set for monsters in the specified geohash.
 */
function monstersInGeohashQuerySet(geohash: string): Search {
    return monsterRepository.search().where("geohash").eq(`${geohash}*`);
}

/**
 * Spawns a monster in a specific geohash.
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

    // Get monster stats
    const { hp, mp, st, ap } = monsterStats({ level, beast });
    const monster: MonsterEntity = {
        monster: `${beast}${count}`, // unique monster id
        name: beast,
        beast,
        geohash,
        level,
        hp,
        mp,
        st,
        ap,
        buffs: [],
        debuffs: [],
    };
    return (await monsterRepository.save(
        `${beast}${count}`,
        monster,
    )) as MonsterEntity;
}
