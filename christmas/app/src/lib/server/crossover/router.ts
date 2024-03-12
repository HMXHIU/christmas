import { PUBLIC_REFRESH_JWT_EXPIRES_IN } from "$env/static/public";
import { biomesAtTile } from "$lib/crossover/world";
import {
    initializeClients,
    playerRepository,
    redisClient,
} from "$lib/server/crossover/redis";
import { PublicKey } from "@solana/web3.js";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
    getLoadedPlayerEntity,
    getUserMetadata,
    initPlayerEntity,
    loadPlayerEntity,
    playersInTileQuerySet,
    savePlayerEntityState,
} from ".";
import {
    FEE_PAYER_PUBKEY,
    createSerializedTransaction,
    hashObject,
    serverAnchorClient,
} from "..";
import type { MessageEventData } from "../../../routes/api/crossover/stream/+server";
import { ObjectStorage } from "../objectStorage";
import { authProcedure, t } from "../trpc";
import type { Player, PlayerEntity } from "./redis/entities";

export {
    PlayerMetadataSchema,
    PlayerStateSchema,
    SayCommandSchema,
    TileSchema,
    UserMetadataSchema,
    crossoverRouter,
};

// Initialize redis clients, repositiories, indexes
initializeClients();

// Schemas
const SayCommandSchema = z.object({
    message: z.string(),
});
const LookCommandSchema = z.object({
    target: z.string().optional(),
});
const SignupAuthSchema = z.object({
    name: z.string(),
});

const TileSchema = z.object({
    tile: z.string(),
    name: z.string(),
    description: z.string(),
});

// PlayerState stores data owned by the game (does not require player permission to modify)
const PlayerStateSchema = z.object({
    tile: z.string().optional(),
    loggedIn: z.boolean().optional(),
});
// PlayerMetadata stores data owned by the player (requires player to sign transactions to modify)
const PlayerMetadataSchema = z.object({
    player: z.string(),
    name: z.string().min(1).max(100),
    description: z.string().max(400).optional(),
});
const UserMetadataSchema = z.object({
    publicKey: z.string(),
    crossover: PlayerMetadataSchema.optional(),
});
const LoginSchema = z.object({
    geohash: z.string(),
    region: z.string(),
});

const LOOK_PAGE_SIZE = 20;

// Router
const crossoverRouter = {
    // World
    world: t.router({
        // wordl.biomesAtTile (can be generated on client side)
        biomesAtTile: authProcedure
            .input(z.object({ tile: z.string() }))
            .query(async ({ input }) => {
                const { tile } = input;
                return biomesAtTile(tile);
            }),
    }),
    // Commands
    cmd: t.router({
        // cmd.say
        say: authProcedure
            .input(SayCommandSchema)
            .query(async ({ ctx, input }) => {
                // Get player
                const player = await getLoadedPlayerEntity(ctx.user.publicKey);
                if (player == null) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: `Player ${ctx.user.publicKey} not found`,
                    });
                }

                // Get logged in players in tile
                const users = await playersInTileQuerySet(player.tile).allIds();

                // Create message data
                const messageData: MessageEventData = {
                    eventType: "cmd",
                    message: "${origin} says ${message}",
                    variables: {
                        cmd: "say",
                        origin: ctx.user.publicKey,
                        message: input.message,
                    },
                };
                const message = JSON.stringify(messageData);

                // Send message to all users in the tile
                for (const publicKey of users) {
                    redisClient.publish(publicKey, message);
                }
            }),
        // cmd.look
        look: authProcedure
            .input(LookCommandSchema)
            .query(async ({ ctx, input }) => {
                // Get player
                const player = await getLoadedPlayerEntity(ctx.user.publicKey);
                if (player == null) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: `Player ${ctx.user.publicKey} not found`,
                    });
                }

                // Get logged in players in tile
                const players = (await playersInTileQuerySet(player.tile).all({
                    pageSize: LOOK_PAGE_SIZE,
                })) as PlayerEntity[];

                return {
                    // TODO: actually get tile data
                    tile: {
                        tile: player.tile,
                        name: "The Inn",
                        description:
                            "A timber-framed inn, its thatched roof sloping gently over leaded windows. Lantern light flickers within, casting shadows on worn wooden tables and tapestried walls. The scent of ale mingles with hearth smoke, welcoming weary travelers to rest amidst rustic charm.",
                    },
                    players: players as Player[],
                };
            }),
    }),
    // Authentication
    auth: t.router({
        // auth.signup
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
                const player = await getLoadedPlayerEntity(ctx.user.publicKey);
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

        // auth.login
        login: authProcedure
            .input(LoginSchema)
            .query(async ({ ctx, input }) => {
                const { geohash, region } = input;

                // Get or load player
                let player =
                    (await getLoadedPlayerEntity(ctx.user.publicKey)) ||
                    (await loadPlayerEntity(ctx.user.publicKey));

                // Init player (tile, etc...)
                player.loggedIn = true;
                player = await initPlayerEntity(
                    { player, geohash, region },
                    { forceSave: true },
                );

                // Save player state
                await savePlayerEntityState(ctx.user.publicKey);

                // Set player cookie (to know if user has signed up for crossover)
                ctx.cookies.set("player", ctx.user.publicKey, {
                    path: "/",
                    httpOnly: true,
                    secure: true,
                    sameSite: "strict",
                    maxAge: parseInt(PUBLIC_REFRESH_JWT_EXPIRES_IN), // in seconds
                });

                return { status: "success", player: player as Player };
            }),

        // auth.logout
        logout: authProcedure.query(async ({ ctx }) => {
            // Get player
            let player = await getLoadedPlayerEntity(ctx.user.publicKey);
            if (player == null) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: `Player ${ctx.user.publicKey} not loaded`,
                });
            }
            // Set `loggedIn=false` & save player state
            player.loggedIn = false;
            await playerRepository.save(player.player, player);
            await savePlayerEntityState(ctx.user.publicKey);

            // Remove player cookie
            ctx.cookies.delete("player", {
                path: "/",
            });

            return { status: "success", player: player as Player };
        }),

        // auth.player
        player: authProcedure.query(async ({ ctx }) => {
            // Get or load player
            let player =
                (await getLoadedPlayerEntity(ctx.user.publicKey)) ||
                (await loadPlayerEntity(ctx.user.publicKey));

            // Set player cookie (to know if user has signed up for crossover)
            ctx.cookies.set("player", ctx.user.publicKey, {
                path: "/",
                httpOnly: true,
                secure: true,
                sameSite: "strict",
                maxAge: parseInt(PUBLIC_REFRESH_JWT_EXPIRES_IN), // in seconds
            });

            return player as Player;
        }),
    }),
};
