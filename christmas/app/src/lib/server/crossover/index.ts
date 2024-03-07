import { serverAnchorClient } from "$lib/server";
import { PublicKey } from "@solana/web3.js";
import type { z } from "zod";
import { playerRepository } from "./redis";
import { type PlayerEntity } from "./redis/entities";
import type { PlayerMetadataSchema, UserMetadataSchema } from "./router";

// Exports
export {
    connectedUsers,
    getLoadedPlayerEntity,
    getPlayerMetadata,
    getUserMetadata,
    initPlayerEntity,
    playersInTile,
    type ConnectedUser,
};

interface ConnectedUser {
    publicKey: string;
    controller: ReadableStreamDefaultController<any>;
}

// Record of connected users on this server instance
let connectedUsers: Record<string, ConnectedUser> = {};

async function getLoadedPlayerEntity(
    publicKey: string,
): Promise<PlayerEntity | null> {
    const player = (await playerRepository.fetch(publicKey)) as PlayerEntity;
    return player.player ? player : null;
}

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

async function initPlayerEntity({
    player,
    region,
    geohash,
}: {
    player: PlayerEntity;
    region: string;
    geohash: string;
}): Promise<PlayerEntity> {
    let changed = false;

    // Initialize tile
    if (!player.tile) {
        player.tile = geohash;
        changed = true;
    }

    // Save if changed
    if (changed) {
        player = (await playerRepository.save(
            player.player,
            player,
        )) as PlayerEntity;
    }

    return player;
}

async function playersInTile(tile: string): Promise<string[]> {
    return playerRepository
        .search()
        .where("loggedIn")
        .equal(true)
        .and("tile")
        .equal(tile)
        .return.allIds();
}
