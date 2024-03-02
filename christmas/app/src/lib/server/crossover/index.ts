import type { UserMetadata } from "$lib/community/types";

import { serverAnchorClient } from "$lib/server";
import { PublicKey } from "@solana/web3.js";
import type { Observer } from "@trpc/server/observable";
import type { z } from "zod";
import { playerRepository } from "./redis";
import { type PlayerEntity } from "./redis/schema";
import type { PlayerMetadataSchema } from "./router";

// Exports
export {
    connectedUsers,
    getLoadedPlayer,
    getPlayerMetadata,
    getUserMetadata,
    type ConnectedUser,
};

interface ConnectedUser {
    publicKey: string;
    stream: ReadableStreamDefaultController<any> | Observer<any, unknown>;
}

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
): Promise<z.infer<typeof PlayerMetadataSchema> | null> {
    return (await getUserMetadata(publicKey))?.crossover || null;
}
