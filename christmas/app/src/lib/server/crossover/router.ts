import { PUBLIC_REFRESH_JWT_EXPIRES_IN } from "$env/static/public";
import { biomeAtGeohash, tileAtGeohash } from "$lib/crossover/world";
import { compendium, worldSeed } from "$lib/crossover/world/settings";
import {
    fetchEntity,
    initializeClients,
    itemRepository,
    playerRepository,
    redisClient,
} from "$lib/server/crossover/redis";
import { PublicKey } from "@solana/web3.js";
import { TRPCError } from "@trpc/server";
import { performance } from "perf_hooks";
import { z } from "zod";
import {
    configureItem,
    getUserMetadata,
    initPlayerEntity,
    isDirectionTraversable,
    loadPlayerEntity,
    performAbility,
    saveEntity,
    savePlayerEntityState,
    spawnItem,
    spawnMonster,
    useItem,
} from ".";
import {
    FEE_PAYER_PUBKEY,
    createSerializedTransaction,
    hashObject,
    serverAnchorClient,
} from "..";
import type { MessageFeed } from "../../../routes/api/crossover/stream/+server";
import { ObjectStorage } from "../objectStorage";
import { authProcedure, internalServiceProcedure, t } from "../trpc";
import { performMonsterActions, spawnMonsters } from "./dungeonMaster";
import {
    loggedInPlayersQuerySet,
    monstersInGeohashQuerySet,
    playerInventoryQuerySet,
    playersInGeohashQuerySet,
} from "./redis";
import type {
    Item,
    ItemEntity,
    Monster,
    MonsterEntity,
    Player,
    PlayerEntity,
} from "./redis/entities";

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
const SpawnMonsterSchema = z.object({
    geohash: z.string(),
    level: z.number(),
    beast: z.string(),
});
const PerformAbilitySchema = z.object({
    ability: z.string(),
    target: z.string(),
});
const UseItemSchema = z.object({
    item: z.string(),
    action: z.string(),
    target: z.string().optional(),
});
const ConfigureItemSchema = z.object({
    item: z.string(),
    variables: z.record(z.union([z.string(), z.number(), z.boolean()])),
});
const CreateItemSchema = z.object({
    geohash: z.string(), // TODO: if not provided, item is created in player inventory
    prop: z.string(),
    variables: z
        .record(z.union([z.string(), z.number(), z.boolean()]))
        .optional(),
});
const EquipItemSchema = z.object({
    item: z.string(),
    slot: z.enum(["rh", "lh", "ft", "hd", "nk", "ch", "lg", "r1", "r2"]),
});

const BuffEntitySchema = z.object({
    entity: z.string(),
    hp: z.number().optional(),
    mp: z.number().optional(),
    st: z.number().optional(),
    ap: z.number().optional(),
    buffs: z.array(z.string()).optional(),
    debuffs: z.array(z.string()).optional(),
});

// PlayerState stores data owned by the game (does not require player permission to modify)
const PlayerStateSchema = z.object({
    location: z.array(z.string()).optional(),
    locationType: z.string().optional(),
    loggedIn: z.boolean().optional(),
    hp: z.number().optional(),
    mp: z.number().optional(),
    st: z.number().optional(),
    ap: z.number().optional(),
    level: z.number().optional(),
    buffs: z.array(z.string()).optional(),
    debuffs: z.array(z.string()).optional(),
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
        respawnMonsters: internalServiceProcedure.mutation(async () => {
            const start = performance.now();
            // Get all logged in players
            const players =
                (await loggedInPlayersQuerySet().return.all()) as PlayerEntity[];

            await spawnMonsters(players);

            const end = performance.now();
            return { status: "success", time: end - start };
        }),
        animateMonsters: internalServiceProcedure.mutation(async () => {
            const start = performance.now();
            // Get all logged in players
            const players =
                (await loggedInPlayersQuerySet().return.all()) as PlayerEntity[];
            await performMonsterActions(players);
            const end = performance.now();
            return { status: "success", time: end - start };
        }),
        spawnMonster: internalServiceProcedure
            .input(SpawnMonsterSchema)
            .mutation(async ({ input }) => {
                const { geohash, level, beast } = input;

                // Check geohash is unit precision
                if (geohash.length !== worldSeed.spatial.unit.precision) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: `Geohash must be unit precision`,
                    });
                }

                const monster = await spawnMonster({ geohash, level, beast });
                return monster;
            }),
        buffEntity: internalServiceProcedure
            .input(BuffEntitySchema)
            .mutation(async ({ input }) => {
                const { entity, hp, mp, st, ap, buffs, debuffs } = input;

                // Get `player` or `monster` enity
                let fetchedEntity = await tryFetchEntity(entity);

                if (!fetchedEntity.player && !fetchedEntity.monster) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: `${entity} is not a player or monster`,
                    });
                }

                // Buff entity
                fetchedEntity.hp = hp ?? fetchedEntity.hp;
                fetchedEntity.mp = mp ?? fetchedEntity.mp;
                fetchedEntity.st = st ?? fetchedEntity.st;
                fetchedEntity.ap = ap ?? fetchedEntity.ap;
                fetchedEntity.buffs = buffs ?? fetchedEntity.buffs;
                fetchedEntity.debuffs = debuffs ?? fetchedEntity.debuffs;

                // Save entity
                return await saveEntity(fetchedEntity);
            }),
    }),
    // Player
    player: t.router({
        // player.inventory
        inventory: authProcedure.query(async ({ ctx }) => {
            // Get player
            const player = (await tryFetchEntity(
                ctx.user.publicKey,
            )) as PlayerEntity;

            const inventoryItems = (await playerInventoryQuerySet(
                player.player,
            ).return.all()) as ItemEntity[];

            return inventoryItems as Item[];
        }),
        // player.equip
        equip: authProcedure
            .input(EquipItemSchema)
            .query(async ({ ctx, input }) => {
                const { item, slot } = input;

                // Get player
                const player = (await tryFetchEntity(
                    ctx.user.publicKey,
                )) as PlayerEntity;

                let itemToEquip = (await tryFetchEntity(item)) as ItemEntity;

                // Check if item is in player inventory (can be inventory or equipment slot)
                if (itemToEquip.location[0] !== player.player) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: `${item} is not in inventory`,
                    });
                }

                // Check equipment slot
                const slots = compendium[itemToEquip.prop].equipmentSlot;
                if (!slots) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: `${item} is not equippable`,
                    });
                }
                if (!slots.includes(slot)) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: `${item} cannot be equipped in ${slot}`,
                    });
                }

                // Unequip existing item in slot
                const exitingItemsInSlot = (await playerInventoryQuerySet(
                    player.player,
                )
                    .and("locationType")
                    .equal(slot)
                    .return.all()) as ItemEntity[];
                for (const itemEntity of exitingItemsInSlot) {
                    itemEntity.location = [player.player];
                    itemEntity.locationType = "inv";
                    await itemRepository.save(itemEntity.item, itemEntity);
                }

                // Equip item in slot
                itemToEquip.location = [player.player];
                itemToEquip.locationType = slot;

                itemToEquip = (await itemRepository.save(
                    itemToEquip.item,
                    itemToEquip,
                )) as ItemEntity;

                return itemToEquip as Item;
            }),
        // player.unequip
        unequip: authProcedure
            .input(
                z.object({
                    item: z.string(),
                }),
            )
            .query(async ({ ctx, input }) => {
                const { item } = input;

                // Get player
                const player = (await tryFetchEntity(
                    ctx.user.publicKey,
                )) as PlayerEntity;

                // Unequip item
                let itemEntity = (await tryFetchEntity(item)) as ItemEntity;
                itemEntity.location = [player.player];
                itemEntity.locationType = "inv";
                itemEntity = (await itemRepository.save(
                    itemEntity.item,
                    itemEntity,
                )) as ItemEntity;

                return itemEntity as Item;
            }),
    }),
    // Commands
    cmd: t.router({
        // cmd.take
        take: authProcedure
            .input(
                z.object({
                    item: z.string(),
                }),
            )
            .query(async ({ ctx, input }) => {
                const { item } = input;

                // Get player
                const player = (await tryFetchEntity(
                    ctx.user.publicKey,
                )) as PlayerEntity;

                // Get item
                let itemEntity = (await tryFetchEntity(item)) as ItemEntity;

                // Check item owner is player or public
                if (itemEntity.owner !== player.player && itemEntity.owner) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: `${item} is owned by someone else`,
                    });
                }

                // Check if in range
                if (itemEntity.location[0] !== player.location[0]) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: `${item} is not in range`,
                    });
                }

                // Check if item is takeable
                if (compendium[itemEntity.prop].weight < 0) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: `${item} cannot be taken`,
                    });
                }

                // Take item
                itemEntity.location = [player.player];
                itemEntity.locationType = "inv";
                itemEntity = (await itemRepository.save(
                    itemEntity.item,
                    itemEntity,
                )) as ItemEntity;

                return itemEntity as Item;
            }),
        // cmd.drop
        drop: authProcedure
            .input(
                z.object({
                    item: z.string(),
                }),
            )
            .query(async ({ ctx, input }) => {
                const { item } = input;

                // Get player
                const player = (await tryFetchEntity(
                    ctx.user.publicKey,
                )) as PlayerEntity;

                // Check item is in player inventory
                let itemEntity = (await tryFetchEntity(item)) as ItemEntity;
                if (itemEntity.location[0] !== player.player) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: `${item} is not in inventory`,
                    });
                }

                // Drop item
                itemEntity.location = player.location;
                itemEntity.locationType = "geohash";
                itemEntity = (await itemRepository.save(
                    itemEntity.item,
                    itemEntity,
                )) as ItemEntity;

                return itemEntity as Item;
            }),
        // cmd.say
        say: authProcedure
            .input(SayCommandSchema)
            .query(async ({ ctx, input }) => {
                // Get player
                const player = (await tryFetchEntity(
                    ctx.user.publicKey,
                )) as PlayerEntity;

                // Get logged in players in geohash
                const users = await playersInGeohashQuerySet(
                    player.location[0],
                ).return.allIds();

                // Create message feed
                const messageFeed: MessageFeed = {
                    type: "message",
                    message: "${origin} says ${message}",
                    variables: {
                        cmd: "say",
                        origin: ctx.user.publicKey,
                        message: input.message,
                    },
                };

                // Send message to all users in the geohash
                for (const publicKey of users) {
                    redisClient.publish(publicKey, JSON.stringify(messageFeed));
                }
            }),
        // cmd.look
        look: authProcedure
            .input(LookCommandSchema)
            .query(async ({ ctx, input }) => {
                // Get player
                const player = await tryFetchEntity(ctx.user.publicKey);

                // Get logged in players in geohash
                const players = (await playersInGeohashQuerySet(
                    player.location[0],
                ).return.all({
                    pageSize: LOOK_PAGE_SIZE,
                })) as PlayerEntity[];

                // Get monsters in surrounding (don't use page size for monsters)
                const monsters = (await monstersInGeohashQuerySet(
                    player.location[0].slice(0, -1),
                ).return.all()) as MonsterEntity[];

                // Get tile
                const biome = biomeAtGeohash(player.location[0]);

                // TODO: inclue POI when generating tile

                return {
                    tile: tileAtGeohash(player.location[0], biome),
                    players: players as Player[],
                    monsters: monsters as Monster[],
                };
            }),
        // cmd.move
        move: authProcedure.input(MoveSchema).query(async ({ ctx, input }) => {
            const { direction } = input;

            // Get player
            const player = (await tryFetchEntity(
                ctx.user.publicKey,
            )) as PlayerEntity;

            // Check if direction is traversable
            const [isTraversable, location] = await isDirectionTraversable(
                player,
                direction,
            );
            if (!isTraversable) {
                return player.location;
            }

            player.location = location;
            await playerRepository.save(player.player, player);
            return player.location;
        }),
        // cmd.performAbility
        performAbility: authProcedure
            .input(PerformAbilitySchema)
            .query(async ({ ctx, input }) => {
                const { ability, target } = input;

                // Get player
                const player = (await tryFetchEntity(
                    ctx.user.publicKey,
                )) as PlayerEntity;

                // Get target player
                const targetEntity = await tryFetchEntity(target);

                // Perform ability
                const result = await performAbility({
                    self: player,
                    target: targetEntity,
                    ability,
                });

                return {
                    self: result.self as Player,
                    target: result.target as Player | Monster | Item,
                    status: result.status,
                    message: result.message,
                };
            }),
        // cmd.useItem
        useItem: authProcedure
            .input(UseItemSchema)
            .query(async ({ ctx, input }) => {
                const { item, action, target } = input;

                // Get player
                const player = (await tryFetchEntity(
                    ctx.user.publicKey,
                )) as PlayerEntity;

                // Get item
                const itemEntity = (await tryFetchEntity(item)) as ItemEntity;

                // Use Item
                const result = await useItem({
                    self: player,
                    item: itemEntity,
                    target: target ? await tryFetchEntity(target) : undefined, // get target if provided
                    action,
                });

                return {
                    item: result.item as Item,
                    self: result.self as Player,
                    target: result.target as Player | Monster | Item,
                    status: result.status,
                    message: result.message,
                };
            }),
        // cmd.createItem
        createItem: authProcedure
            .input(CreateItemSchema)
            .query(async ({ ctx, input }) => {
                const { geohash, prop, variables } = input;

                // Get player
                const player = (await tryFetchEntity(
                    ctx.user.publicKey,
                )) as PlayerEntity;

                // Create item
                return (await spawnItem({
                    geohash,
                    prop,
                    variables,
                    owner: player.player, // owner is player
                    configOwner: player.player,
                })) as Item;
            }),
        // cmd.configureItem
        configureItem: authProcedure
            .input(ConfigureItemSchema)
            .query(async ({ ctx, input }) => {
                const { item, variables } = input;

                // Get player
                const player = (await tryFetchEntity(
                    ctx.user.publicKey,
                )) as PlayerEntity;

                // Get & configure item
                const result = await configureItem({
                    self: player,
                    item: (await tryFetchEntity(item)) as ItemEntity,
                    variables,
                });
                return {
                    item: result.item as Item,
                    status: result.status,
                    message: result.message,
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
                const player = await fetchEntity(ctx.user.publicKey);
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
                    ((await fetchEntity(ctx.user.publicKey)) as PlayerEntity) ||
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
            const player = (await tryFetchEntity(
                ctx.user.publicKey,
            )) as PlayerEntity;

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

        // auth.player (TODO: move to player.player)
        player: authProcedure.query(async ({ ctx }) => {
            // Get or load player
            let player =
                (await fetchEntity(ctx.user.publicKey)) ||
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

async function tryFetchEntity(
    entity: string,
): Promise<PlayerEntity | MonsterEntity | ItemEntity> {
    const fetchedEntity = await fetchEntity(entity);

    if (fetchedEntity == null) {
        throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Entity ${entity} not found`,
        });
    }
    return fetchedEntity;
}