import { PUBLIC_REFRESH_JWT_EXPIRES_IN } from "$env/static/public";
import { playerRepository, redisClient } from "$lib/server/crossover/redis";
import { PublicKey } from "@solana/web3.js";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
    connectedUsers,
    getLoadedPlayer,
    getPlayerMetadata,
    getUserMetadata,
} from ".";
import {
    FEE_PAYER_PUBKEY,
    createSerializedTransaction,
    hashObject,
    serverAnchorClient,
} from "..";
import { ObjectStorage } from "../objectStorage";
import { authProcedure, t } from "../trpc";
import type { PlayerEntity } from "./redis/schema";

export { PlayerMetadataSchema, UserMetadataSchema, crossoverRouter };

// Schemas
const SayCommandSchema = z.object({
    message: z.string(),
});
const SignupAuthSchema = z.object({
    name: z.string(),
});
const PlayerMetadataSchema = z.object({
    player: z.string(),
    name: z.string().min(1).max(100),
    description: z.string().max(400).optional(),
    tile: z.string().optional(),
    loggedIn: z.boolean().optional(),
});
const UserMetadataSchema = z.object({
    publicKey: z.string(),
    crossover: PlayerMetadataSchema.optional(),
});

// Router
const crossoverRouter = {
    // Commands
    cmd: t.router({
        // Say
        say: authProcedure
            .input(SayCommandSchema)
            .query(async ({ ctx, input }) => {
                // Get user's tile

                // TODO: Get all users in the tile
                const users = Object.values(connectedUsers);

                // Send message to all users in the tile
                for (const { publicKey } of users) {
                    redisClient.publish(
                        publicKey,
                        JSON.stringify({
                            origin: ctx.user.publicKey,
                            cmd: "say",
                            input,
                        }),
                    );
                }
            }),
    }),
    // Authentication
    auth: t.router({
        // Signup
        signup: authProcedure
            .input(SignupAuthSchema)
            .query(async ({ ctx, input }) => {
                // Get user account
                const user = await serverAnchorClient.getUser(
                    new PublicKey(ctx.user.publicKey),
                );
                if (user == null) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: `User account ${ctx.user.publicKey} does not exist`,
                    });
                }

                // Get player name from input
                const { name } = input;

                // Check if player already exists
                const player = await getLoadedPlayer(ctx.user.publicKey);
                if (player != null) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: `Player ${ctx.user.publicKey} already exists (loaded)`,
                    });
                }

                // Get user metadata
                let userMetadata = await getUserMetadata(ctx.user.publicKey);

                // Check if player metadata (userMetadata.crossover) already exists
                if (userMetadata?.crossover != null) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: `Player ${ctx.user.publicKey} already exists (storage)`,
                    });
                }

                // Update user metadata with player metadata
                userMetadata = await UserMetadataSchema.parse({
                    ...userMetadata,
                    crossover: {
                        player: ctx.user.publicKey,
                        name,
                    },
                });

                // Store new user metadata and get url
                const userMetadataUrl = await ObjectStorage.putJSONObject({
                    bucket: "user",
                    owner: null,
                    data: userMetadata,
                    name: hashObject(["user", ctx.user.publicKey]),
                });

                // Update account with metadata uri
                const updateUserIx = await serverAnchorClient.updateUserIx({
                    region: user.region,
                    uri: userMetadataUrl,
                    payer: FEE_PAYER_PUBKEY,
                    wallet: new PublicKey(ctx.user.publicKey),
                });

                // Create serialized transaction for user to sign
                const base64Transaction =
                    await createSerializedTransaction(updateUserIx);

                // Set player cookie (to know if user has signed up for crossover)
                ctx.cookies.set("player", ctx.user.publicKey, {
                    path: "/",
                    httpOnly: true,
                    secure: true,
                    sameSite: "strict",
                    maxAge: parseInt(PUBLIC_REFRESH_JWT_EXPIRES_IN), // in seconds
                });

                return {
                    transaction: base64Transaction,
                };
            }),

        // Login
        login: authProcedure.query(async ({ ctx }) => {
            // Get player
            let player = await getLoadedPlayer(ctx.user.publicKey);

            // If player is not loaded, load it from storage
            if (player == null) {
                let playerMetadata = await getPlayerMetadata(
                    ctx.user.publicKey,
                );

                if (playerMetadata == null) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: `Player ${ctx.user.publicKey} not found`,
                    });
                }

                player = (await playerRepository.save(playerMetadata.player, {
                    ...playerMetadata,
                    loggedIn: true,
                })) as PlayerEntity;
            }

            // Set player cookie (to know if user has signed up for crossover)
            ctx.cookies.set("player", ctx.user.publicKey, {
                path: "/",
                httpOnly: true,
                secure: true,
                sameSite: "strict",
                maxAge: parseInt(PUBLIC_REFRESH_JWT_EXPIRES_IN), // in seconds
            });

            return { status: "success", player };
        }),

        // Logout
        logout: authProcedure.query(async ({ ctx }) => {
            // Get player
            let player = await getLoadedPlayer(ctx.user.publicKey);
            if (player == null) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: `Player ${ctx.user.publicKey} not loaded`,
                });
            }
            player.loggedIn = false;
            await playerRepository.save(player.player, player);

            // Remove player cookie
            ctx.cookies.delete("player", {
                path: "/",
            });

            return { status: "success", player };
        }),

        // Player
        player: authProcedure.query(async ({ ctx }) => {
            // Get loaded player (if loaded)
            let p: PlayerEntity | null = await getLoadedPlayer(
                ctx.user.publicKey,
            );
            if (p == null) {
                // Load player from storage
                let playerMetadata = await getPlayerMetadata(
                    ctx.user.publicKey,
                );

                if (playerMetadata == null) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: `Player ${ctx.user.publicKey} not found`,
                    });
                }

                p = (await playerRepository.save(playerMetadata.player, {
                    ...playerMetadata,
                    loggedIn: false, // do not login user when creating for the first time from storage
                })) as PlayerEntity;
            }

            // Set player cookie (to know if user has signed up for crossover)
            ctx.cookies.set("player", ctx.user.publicKey, {
                path: "/",
                httpOnly: true,
                secure: true,
                sameSite: "strict",
                maxAge: parseInt(PUBLIC_REFRESH_JWT_EXPIRES_IN), // in seconds
            });

            return p as z.infer<typeof PlayerMetadataSchema>;
        }),
    }),
};
