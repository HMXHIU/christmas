import { UserMetadataSchema } from "$lib/community/types.js";
import {
    PlayerMetadataSchema,
    type PlayerMetadata,
} from "$lib/crossover/types.js";
import {
    getLoadedPlayer,
    getPlayerMetadata,
    getUserMetadata,
} from "$lib/server/crossover/index.js";
import { playerRepository } from "$lib/server/crossover/redis/index.js";

import { type PlayerEntity } from "$lib/server/crossover/redis/schema.js";
import {
    FEE_PAYER_PUBKEY,
    createSerializedTransaction,
    hashObject,
    requireLogin,
    serverAnchorClient,
} from "$lib/server/index.js";
import { ObjectStorage } from "$lib/server/objectStorage.js";

import { PublicKey } from "@solana/web3.js";
import { error, json } from "@sveltejs/kit";

export async function POST(event) {
    const { request, params } = event;
    const { op } = params;

    // All auth methods require login
    const userSession = requireLogin(event);

    // Check if user account exists (need user account to store player metadata)
    const user = await serverAnchorClient.getUser(
        new PublicKey(userSession.publicKey),
    );
    if (user == null) {
        error(400, `User account ${userSession.publicKey} does not exist`);
    }

    // Login (api/crossover/auth/login)
    if (op === "login") {
        let player = await getLoadedPlayer(userSession.publicKey);

        // If player is not loaded, load it from storage
        if (player == null) {
            let playerMetadata = await getPlayerMetadata(userSession.publicKey);

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

        // Get user metadata
        let userMetadata = await getUserMetadata(userSession.publicKey);

        // Check if player metadata (userMetadata.crossover) already exists
        if (userMetadata?.crossover != null) {
            error(
                400,
                `Player ${userSession.publicKey} already exists (storage)`,
            );
        }

        // Update user metadata with player metadata
        userMetadata = await UserMetadataSchema.validate({
            ...userMetadata,
            crossover: {
                player: userSession.publicKey,
                name,
            },
        });

        console.log(JSON.stringify(userMetadata, null, 2));

        // Store new user metadata and get url
        const userMetadataUrl = await ObjectStorage.putJSONObject({
            bucket: "user",
            owner: null,
            data: userMetadata,
            name: hashObject(["user", userSession.publicKey]),
        });

        // Update Account with metadata uri
        const updateUserIx = await serverAnchorClient.updateUserIx({
            region: user.region,
            uri: userMetadataUrl,
            payer: FEE_PAYER_PUBKEY,
            wallet: new PublicKey(userSession.publicKey),
        });

        // Create serialized transaction for user to sign
        const base64Transaction =
            await createSerializedTransaction(updateUserIx);

        return json({
            transaction: base64Transaction,
        });
    }
}
