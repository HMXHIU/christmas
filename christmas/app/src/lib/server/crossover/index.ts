import type { ConnectedUser } from "./types";
import { serverAnchorClient } from "$lib/server";
import { PublicKey } from "@solana/web3.js";
import { type PlayerEntity } from "./redis/schema";
import { playerRepository } from "./redis";
import type { PlayerMetadata } from "$lib/crossover/types";
import type { UserMetadata } from "$lib/community/types";

// Exports
export { connectedUsers, getLoadedPlayer, getPlayerMetadata, getUserMetadata };

// Record of connected users on this server instance
let connectedUsers: Record<string, ConnectedUser> = {};

async function getLoadedPlayer(
    publicKey: string,
): Promise<PlayerEntity | null> {
    const player = (await playerRepository.fetch(publicKey)) as PlayerEntity;
    return player.player ? player : null;
}

async function getUserMetadata(
    publicKey: string,
): Promise<UserMetadata | null> {
    const user = await serverAnchorClient.getUser(new PublicKey(publicKey));

    if (user == null) {
        throw new Error(`User account ${publicKey} does not exist`);
    }

    if (!user?.uri) {
        throw new Error(`User account ${publicKey} missing metadata uri`);
    }

    // Load metadata
    let response = await fetch(user.uri);
    const userMetadata: UserMetadata = await response.json();

    return userMetadata || null;
}

async function getPlayerMetadata(
    publicKey: string,
): Promise<PlayerMetadata | null> {
    return (await getUserMetadata(publicKey))?.crossover || null;
}
