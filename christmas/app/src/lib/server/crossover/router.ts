import { PUBLIC_REFRESH_JWT_EXPIRES_IN } from "$env/static/public";
import {
    biomeAtGeohash,
    geohashNeighbour,
    tileAtGeohash,
} from "$lib/crossover/world";
import { biomes } from "$lib/crossover/world/resources";
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
    playersInGeohashQuerySet,
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
    geohash: z.string(),
    name: z.string(),
    description: z.string(),
});
const MoveSchema = z.object({
    direction: z.enum(["n", "s", "e", "w", "ne", "nw", "se", "sw", "u", "d"]),
});

// PlayerState stores data owned by the game (does not require player permission to modify)
const PlayerStateSchema = z.object({
    geohash: z.string().optional(),
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
    world: t.router({}),
    // Commands
    cmd: t.router({
        // cmd.say
        say: authProcedure
            .input(SayCommandSchema)
            .query(async ({ ctx, input }) => {
                // Get player
                const player = await getPlayer(ctx.user.publicKey);

                // Get logged in players in geohash
                const users = await playersInGeohashQuerySet(
                    player.geohash,
                ).return.allIds();

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

                // Send message to all users in the geohash
                for (const publicKey of users) {
                    redisClient.publish(publicKey, message);
                }
            }),
        // cmd.look
        look: authProcedure
            .input(LookCommandSchema)
            .query(async ({ ctx, input }) => {
                // Get player
                const player = await getPlayer(ctx.user.publicKey);

                // Get logged in players in geohash
                const players = (await playersInGeohashQuerySet(
                    player.geohash,
                ).return.all({
                    pageSize: LOOK_PAGE_SIZE,
                })) as PlayerEntity[];

                const biome = biomeAtGeohash(player.geohash);

                return {
                    tile: tileAtGeohash(player.geohash, biome), // TODO: inclue POI when generating tile
                    players: players as Player[],
                };
            }),
        // cmd.move
        move: authProcedure.input(MoveSchema).query(async ({ ctx, input }) => {
            const { direction } = input;

            // Get player
            const player = await getPlayer(ctx.user.publicKey);

            // Check if next geohash is travasable
            const nextGeohash = geohashNeighbour(player.geohash, direction);
            const biome = biomeAtGeohash(nextGeohash);
            const traversable = biomes[biome]?.metadata?.traversable;

            if (traversable) {
                // Update player geohash
                player.geohash = nextGeohash;
                await playerRepository.save(player.player, player);
                return nextGeohash;
            }

            return player.geohash;
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

                // Init player
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
            const player = await getPlayer(ctx.user.publicKey);

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

async function getPlayer(publicKey: string): Promise<PlayerEntity> {
    // Get player
    const player = await getLoadedPlayerEntity(publicKey);
    if (player == null) {
        throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Player ${publicKey} not found`,
        });
    }
    return player;
}
