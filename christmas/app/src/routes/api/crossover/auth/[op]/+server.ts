import { PlayerMetadataSchema } from "$lib/crossover/types.js";
import {
    getLoadedPlayer,
    getPlayerMetadataFromStorage,
} from "$lib/server/crossover/index.js";
import { playerRepository } from "$lib/server/crossover/redis/index.js";

import { type PlayerEntity } from "$lib/server/crossover/redis/schema.js";
import {
    createSerializedTransaction,
    requireLogin,
    serverAnchorClient,
} from "$lib/server/index.js";

import { PublicKey } from "@solana/web3.js";
import { error, json } from "@sveltejs/kit";

export async function POST(event) {
    const { request, params } = event;
    const { op } = params;

    // all auth methods require login
    const userSession = requireLogin(event);

    // Login (api/crossover/auth/login)
    if (op === "login") {
        let player = await getLoadedPlayer(userSession.publicKey);

        // If player is not loaded, load it from storage
        if (player == null) {
            let playerMetadata = await getPlayerMetadataFromStorage(
                userSession.publicKey,
            );

            if (playerMetadata == null) {
                error(400, `Player ${userSession.publicKey} not found`);
            }

            player = (await playerRepository.save(playerMetadata.player, {
                ...playerMetadata,
                loggedIn: true,
            })) as PlayerEntity;
        }

        return json({ status: "success", player });
    }

    // Logout (api/crossover/auth/logout)
    else if (op === "logout") {
        let player = await getLoadedPlayer(userSession.publicKey);
        if (player == null) {
            error(400, `Player ${userSession.publicKey} not loaded`);
        }
        player.loggedIn = false;
        await playerRepository.save(player.player, player);
        return json({ status: "success", player });
    }

    // Refresh (api/crossover/auth/signup)
    else if (op === "signup") {
        try {
            // Get name from request body
            const { name } = await request.json();

            // Check if player already exists
            const player = await getLoadedPlayer(userSession.publicKey);
            if (player != null) {
                error(
                    400,
                    `Player ${userSession.publicKey} already exists (loaded)`,
                );
            }
            let playerMetadata = await getPlayerMetadataFromStorage(
                userSession.publicKey,
            );
            if (playerMetadata != null) {
                error(
                    400,
                    `Player ${userSession.publicKey} already exists (storage)`,
                );
            }

            // Check if user account exists (need user account to store player metadata)
            const user = await serverAnchorClient.getUser(
                new PublicKey(userSession.publicKey),
            );
            if (user == null) {
                error(
                    400,
                    `User account ${userSession.publicKey} does not exist`,
                );
            }

            // Initialize player metadata
            playerMetadata = {
                player: userSession.publicKey,
                name,
            };

            // Validate player metadata
            await PlayerMetadataSchema.validate(playerMetadata);

            // Store player metadata
            let response = await fetch(`/api/storage/user/public`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(playerMetadata),
            });
            const { status, url } = await response.json();
            if (status !== "success") {
                error(500, `Failed to create player metadata: ${status}`);
            }

            // Update Account with metadata uri
            const updateUserIx = await serverAnchorClient.updateUserIx({
                wallet: new PublicKey(userSession.publicKey),
                region: user.region,
                uri: url,
            });

            // Create serialized transaction for user to sign
            const base64Transaction = createSerializedTransaction(updateUserIx);

            return json({
                transaction: base64Transaction,
            });
        } catch (err: any) {
            error(500, err.message);
        }
    }
}
