import { serverAnchorClient } from "$lib/server";
import { parseZodErrors } from "$lib/utils";
import { PublicKey } from "@solana/web3.js";
import type { AbstractSearch } from "redis-om";
import { z } from "zod";
import { ObjectStorage } from "../objectStorage";
import { playerRepository } from "./redis";
import { type PlayerEntity } from "./redis/entities";
import {
    PlayerStateSchema,
    type PlayerMetadataSchema,
    type UserMetadataSchema,
} from "./router";

// Exports
export {
    connectedUsers,
    getLoadedPlayerEntity,
    getPlayerMetadata,
    getUserMetadata,
    initPlayerEntity,
    loadPlayerEntity,
    playersInTileQuerySet,
    savePlayerEntityState,
    type ConnectedUser,
};

interface ConnectedUser {
    publicKey: string;
    controller: ReadableStreamDefaultController<any>;
}

// Record of connected users on this server instance
let connectedUsers: Record<string, ConnectedUser> = {};

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

async function getPlayerMetadata(
    publicKey: string,
): Promise<z.infer<typeof PlayerMetadataSchema> | null> {
    return (await getUserMetadata(publicKey))?.crossover || null;
}

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

async function getLoadedPlayerEntity(
    publicKey: string,
): Promise<PlayerEntity | null> {
    const player = (await playerRepository.fetch(publicKey)) as PlayerEntity;
    return player.player ? player : null;
}

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

    // Initialize tile
    if (!player.tile) {
        player.tile = geohash;
        changed = true;
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

async function savePlayerEntityState(publicKey: string): Promise<string> {
    return await setPlayerState(
        publicKey,
        (await playerRepository.fetch(publicKey)) as PlayerEntity,
    );
}

function playersInTileQuerySet(tile: string): AbstractSearch {
    return playerRepository
        .search()
        .where("loggedIn")
        .equal(true)
        .and("tile")
        .equal(tile).return;
}
