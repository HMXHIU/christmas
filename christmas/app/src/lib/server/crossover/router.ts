import { PUBLIC_REFRESH_JWT_EXPIRES_IN } from "$env/static/public";
import type { GameCommandResponse } from "$lib/crossover";
import { actions } from "$lib/crossover/actions";
import { geohashesNearby } from "$lib/crossover/utils";
import { playerStats } from "$lib/crossover/world/player";
import {
    TILE_HEIGHT,
    TILE_WIDTH,
    compendium,
    worldSeed,
} from "$lib/crossover/world/settings";
import {
    fetchEntity,
    initializeClients,
    itemRepository,
    playerRepository,
    redisClient,
    worldsInGeohashQuerySet,
} from "$lib/server/crossover/redis";
import { PublicKey } from "@solana/web3.js";
import { TRPCError } from "@trpc/server";
import { performance } from "perf_hooks";
import { z } from "zod";
import {
    checkAndSetBusy,
    configureItem,
    getNearbyEntities,
    getUserMetadata,
    initPlayerEntity,
    isDirectionTraversable,
    loadPlayerEntity,
    performAbility,
    saveEntity,
    savePlayerEntityState,
    spawnItem,
    spawnMonster,
    spawnWorld,
    useItem,
} from ".";
import {
    FEE_PAYER_PUBKEY,
    createSerializedTransaction,
    hashObject,
    serverAnchorClient,
} from "..";
import type { FeedEvent } from "../../../routes/api/crossover/stream/+server";
import { ObjectStorage } from "../objectStorage";
import { authProcedure, internalServiceProcedure, t } from "../trpc";
import { performMonsterActions, spawnMonsters } from "./dungeonMaster";
import {
    crossoverPlayerInventoryQuerySet,
    loggedInPlayersQuerySet,
    playersInGeohashQuerySet,
} from "./redis";
import type {
    Item,
    ItemEntity,
    MonsterEntity,
    Player,
    PlayerEntity,
    World,
    WorldEntity,
} from "./redis/entities";

export {
    PlayerMetadataSchema,
    PlayerStateSchema,
    SaySchema,
    UserMetadataSchema,
    crossoverRouter,
};

// Initialize redis clients, repositiories, indexes
initializeClients();

// Schemas - auth
const SignupSchema = z.object({
    name: z.string(),
});
const LoginSchema = z.object({
    geohash: z.string(),
    region: z.string(),
});

// Schemas - cmd
const SaySchema = z.object({
    message: z.string(),
});
const LookSchema = z.object({
    target: z.string().optional(),
});
const MoveSchema = z.object({
    direction: z.enum(["n", "s", "e", "w", "ne", "nw", "se", "sw", "u", "d"]),
});
const PerformAbilitySchema = z.object({
    ability: z.string(),
    target: z.string(),
});
const UseItemSchema = z.object({
    item: z.string(),
    utility: z.string(),
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

// Schemas - world
const SpawnMonsterSchema = z.object({
    geohash: z.string(),
    level: z.number(),
    beast: z.string(),
});
const BuffEntitySchema = z.object({
    entity: z.string(),
    hp: z.number().optional(),
    mp: z.number().optional(),
    st: z.number().optional(),
    level: z.number().optional(),
    ap: z.number().optional(),
    buffs: z.array(z.string()).optional(),
    debuffs: z.array(z.string()).optional(),
});
const SpawnWorldSchema = z.object({
    geohash: z.string(),
    url: z.string(),
});

// Schemas - player
const EquipItemSchema = z.object({
    item: z.string(),
    slot: z.enum(["rh", "lh", "ft", "hd", "nk", "ch", "lg", "r1", "r2"]),
});

// PlayerState stores data owned by the game (does not require player permission to modify)
const PlayerStateSchema = z.object({
    location: z.array(z.string()).optional(),
    locT: z.string().optional(),
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
        spawnWorld: internalServiceProcedure
            .input(SpawnWorldSchema)
            .mutation(async ({ input }) => {
                const { geohash, url } = input;
                const world = await spawnWorld({
                    geohash,
                    assetUrl: url,
                    tileHeight: TILE_HEIGHT,
                    tileWidth: TILE_WIDTH,
                });
                return world as World;
            }),
        worlds: authProcedure
            .input(z.object({ geohash: z.string() }))
            .query(async ({ input }) => {
                // Get worlds in town (smallest unit for a collection of worlds)
                let { geohash } = input;
                const town = geohash.slice(0, worldSeed.spatial.town.precision);
                const worlds = (await worldsInGeohashQuerySet([
                    town,
                ]).return.all()) as WorldEntity[];

                // TODO: hash worlds and have API to check world hashes if need for invalidation
                return { town, worlds: worlds as World[] };
            }),
        buffEntity: internalServiceProcedure
            .input(BuffEntitySchema)
            .mutation(async ({ input }) => {
                const { entity, hp, mp, st, ap, level, buffs, debuffs } = input;

                // Get `player` or `monster` enity
                let fetchedEntity = await tryFetchEntity(entity);
                if (!fetchedEntity.player && !fetchedEntity.monster) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: `${entity} is not a player or monster`,
                    });
                }

                // Buff entity
                fetchedEntity.level = level ?? fetchedEntity.level;
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

            // Note: Inventory doesn't cost any ticks
            const inventoryItems = (await crossoverPlayerInventoryQuerySet(
                player.player,
            ).return.all()) as ItemEntity[];

            return {
                items: inventoryItems as Item[],
                status: "success",
                op: "upsert",
            } as GameCommandResponse;
        }),
        // player.equip
        equip: authProcedure
            .input(EquipItemSchema)
            .query(async ({ ctx, input }) => {
                const { item, slot } = input;

                // Get player
                let player = (await tryFetchEntity(
                    ctx.user.publicKey,
                )) as PlayerEntity;

                // Check if player is busy
                const { busy, entity } = await checkAndSetBusy({
                    entity: player,
                    action: actions.equip.action,
                });
                player = entity as PlayerEntity;
                if (busy) {
                    return {
                        status: "failure",
                        message: "You are busy at the moment.",
                    } as GameCommandResponse;
                }

                let itemToEquip = (await tryFetchEntity(item)) as ItemEntity;

                // Check if item is in player inventory (can be inventory or equipment slot)
                if (itemToEquip.location[0] !== player.player) {
                    return {
                        status: "failure",
                        message: `${item} is not in inventory`,
                    } as GameCommandResponse;
                }

                // Check equipment slot
                const slots = compendium[itemToEquip.prop].equipmentSlot;
                if (!slots) {
                    return {
                        status: "failure",
                        message: `${item} is not equippable`,
                    } as GameCommandResponse;
                }
                if (!slots.includes(slot)) {
                    return {
                        status: "failure",
                        message: `${item} cannot be equipped in ${slot}`,
                    } as GameCommandResponse;
                }

                // Unequip existing item in slot
                const exitingItemsInSlot =
                    (await crossoverPlayerInventoryQuerySet(player.player)
                        .and("locT")
                        .equal(slot)
                        .return.all()) as ItemEntity[];
                for (const itemEntity of exitingItemsInSlot) {
                    itemEntity.location = [player.player];
                    itemEntity.locT = "inv";
                    await itemRepository.save(itemEntity.item, itemEntity);
                }

                // Equip item in slot
                itemToEquip.location = [player.player];
                itemToEquip.locT = slot;
                itemToEquip = (await itemRepository.save(
                    itemToEquip.item,
                    itemToEquip,
                )) as ItemEntity;

                return {
                    status: "success",
                    op: "upsert",
                    items: [itemToEquip as Item],
                } as GameCommandResponse;
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
                let itemEntity = (await tryFetchEntity(item)) as ItemEntity;

                // Get player
                let player = (await tryFetchEntity(
                    ctx.user.publicKey,
                )) as PlayerEntity;

                // Check if player is busy
                const { busy, entity } = await checkAndSetBusy({
                    entity: player,
                    action: actions.unequip.action,
                });
                player = entity as PlayerEntity;
                if (busy) {
                    return {
                        status: "failure",
                        message: "You are busy at the moment.",
                    } as GameCommandResponse;
                }

                // Check item is on player
                if (itemEntity.location[0] !== player.player) {
                    return {
                        status: "failure",
                        message: `${item} is not equipped`,
                    } as GameCommandResponse;
                }

                // Unequip item
                itemEntity.location = [player.player];
                itemEntity.locT = "inv";
                itemEntity = (await itemRepository.save(
                    itemEntity.item,
                    itemEntity,
                )) as ItemEntity;

                return {
                    status: "success",
                    op: "upsert",
                    items: [itemEntity as Item],
                } as GameCommandResponse;
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
                let player = (await tryFetchEntity(
                    ctx.user.publicKey,
                )) as PlayerEntity;

                // Check if player is busy
                const { busy, entity } = await checkAndSetBusy({
                    entity: player,
                    action: actions.take.action,
                });
                player = entity as PlayerEntity;
                if (busy) {
                    return {
                        status: "failure",
                        message: "You are busy at the moment.",
                    } as GameCommandResponse;
                }

                // Get item
                let itemEntity = (await tryFetchEntity(item)) as ItemEntity;

                // Check item owner is player or public
                if (itemEntity.owner !== player.player && itemEntity.owner) {
                    return {
                        status: "failure",
                        message: `${item} is owned by someone else`,
                    } as GameCommandResponse;
                }

                // Check if in range
                if (itemEntity.location[0] !== player.location[0]) {
                    return {
                        status: "failure",
                        message: `${item} is not in range`,
                    } as GameCommandResponse;
                }

                // Check if item is takeable
                if (compendium[itemEntity.prop].weight < 0) {
                    return {
                        status: "failure",
                        message: `${item} cannot be taken`,
                    } as GameCommandResponse;
                }

                // Take item
                itemEntity.location = [player.player];
                itemEntity.locT = "inv";
                itemEntity = (await itemRepository.save(
                    itemEntity.item,
                    itemEntity,
                )) as ItemEntity;

                return {
                    status: "success",
                    op: "upsert",
                    items: [itemEntity as Item],
                } as GameCommandResponse;
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
                let player = (await tryFetchEntity(
                    ctx.user.publicKey,
                )) as PlayerEntity;

                // Check if player is busy
                const { busy, entity } = await checkAndSetBusy({
                    entity: player,
                    action: actions.drop.action,
                });
                player = entity as PlayerEntity;
                if (busy) {
                    return {
                        status: "failure",
                        message: "You are busy at the moment.",
                    } as GameCommandResponse;
                }

                // Check item is in player inventory
                let itemEntity = (await tryFetchEntity(item)) as ItemEntity;
                if (itemEntity.location[0] !== player.player) {
                    return {
                        status: "failure",
                        message: `${item} is not in inventory`,
                    } as GameCommandResponse;
                }

                // Drop item
                itemEntity.location = player.location;
                itemEntity.locT = "geohash";
                itemEntity = (await itemRepository.save(
                    itemEntity.item,
                    itemEntity,
                )) as ItemEntity;

                return {
                    status: "success",
                    op: "upsert",
                    items: [itemEntity as Item],
                } as GameCommandResponse;
            }),
        // cmd.say
        say: authProcedure.input(SaySchema).query(async ({ ctx, input }) => {
            // Get player
            let player = (await tryFetchEntity(
                ctx.user.publicKey,
            )) as PlayerEntity;

            // Check if player is busy
            const { busy, entity } = await checkAndSetBusy({
                entity: player,
                action: actions.say.action,
            });
            player = entity as PlayerEntity;
            if (busy) {
                return {
                    status: "failure",
                    message: "You are busy at the moment.",
                } as GameCommandResponse;
            }
            const parentGeohash = player.location[0].slice(0, -1);

            // Get logged in players in geohash
            const players = await playersInGeohashQuerySet(
                geohashesNearby(parentGeohash),
            ).return.allIds({ pageSize: LOOK_PAGE_SIZE }); // limit players using page size

            // Create message feed
            const messageFeed: FeedEvent = {
                event: "feed",
                type: "message",
                message: "${origin} says ${message}",
                variables: {
                    cmd: "say",
                    origin: ctx.user.publicKey,
                    message: input.message,
                },
            };

            // Send message to all players in the geohash (non blocking)
            for (const publicKey of players) {
                redisClient.publish(publicKey, JSON.stringify(messageFeed));
            }

            return {
                status: "success",
                message: "",
            } as GameCommandResponse;
        }),
        // cmd.look
        look: authProcedure.input(LookSchema).query(async ({ ctx, input }) => {
            // Get player
            let player = (await tryFetchEntity(
                ctx.user.publicKey,
            )) as PlayerEntity;

            const { monsters, players, items } = await getNearbyEntities(
                player.location[0],
                LOOK_PAGE_SIZE,
            );

            return {
                players,
                monsters,
                items,
                status: "success",
                op: "replace",
            } as GameCommandResponse;
        }),
        // cmd.move
        move: authProcedure.input(MoveSchema).query(async ({ ctx, input }) => {
            const { direction } = input;

            // Get player
            let player = (await tryFetchEntity(
                ctx.user.publicKey,
            )) as PlayerEntity;

            // Check if direction is traversable
            const [isTraversable, location] = await isDirectionTraversable(
                player,
                direction,
            );

            if (isTraversable) {
                // Check if player is busy
                const { busy, entity } = await checkAndSetBusy({
                    entity: player,
                    action: actions.move.action,
                });
                if (busy) {
                    return {
                        status: "failure",
                        message: "You are busy at the moment.",
                    } as GameCommandResponse;
                }

                // Check if player moves to a different plot
                const plotDidChange =
                    player.location[0].slice(0, -1) !==
                    location[0].slice(0, -1);

                // Update player location
                player = entity as PlayerEntity;
                player.location = location;
                await playerRepository.save(player.player, player);

                // Return nearby entities if plot changed
                if (plotDidChange) {
                    const { monsters, players, items } =
                        await getNearbyEntities(
                            player.location[0],
                            LOOK_PAGE_SIZE,
                        );
                    return {
                        players,
                        monsters,
                        items,
                        status: "success",
                        op: "replace",
                    } as GameCommandResponse;
                }
                // Just update player
                else {
                    return {
                        players: [player as Player],
                        op: "upsert",
                        status: "success",
                    } as GameCommandResponse;
                }
            }
            // Not traversable
            else {
                return {
                    status: "failure",
                    message: `Cannot move ${direction}`,
                } as GameCommandResponse;
            }
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

                // Perform ability (non blocking)
                performAbility({
                    self: player,
                    target: targetEntity,
                    ability,
                }).then(async ({ self, status, message }) => {
                    // Publish feed event on failure
                    if (status === "failure") {
                        if (self.player != null) {
                            await redisClient.publish(
                                (self as Player).player,
                                JSON.stringify({
                                    event: "feed",
                                    type: "message",
                                    message,
                                } as FeedEvent),
                            );
                        }
                    }
                });
            }),
        // cmd.useItem
        useItem: authProcedure
            .input(UseItemSchema)
            .query(async ({ ctx, input }) => {
                const { item, utility, target } = input;

                // Get player
                const player = (await tryFetchEntity(
                    ctx.user.publicKey,
                )) as PlayerEntity;

                // Get item
                const itemEntity = (await tryFetchEntity(item)) as ItemEntity;

                // Use Item (non blocking)
                useItem({
                    self: player,
                    item: itemEntity,
                    target: target ? await tryFetchEntity(target) : undefined, // get target if provided
                    utility,
                }).then(async ({ self, status, message }) => {
                    // Publish feed event on failure
                    if (status === "failure") {
                        if (self.player != null) {
                            await redisClient.publish(
                                (self as Player).player,
                                JSON.stringify({
                                    event: "feed",
                                    type: "message",
                                    message,
                                } as FeedEvent),
                            );
                        }
                    }
                });
            }),
        // cmd.createItem
        createItem: authProcedure
            .input(CreateItemSchema)
            .query(async ({ ctx, input }) => {
                const { geohash, prop, variables } = input;

                // Get player
                let player = (await tryFetchEntity(
                    ctx.user.publicKey,
                )) as PlayerEntity;

                // Check if player is busy
                const { busy, entity } = await checkAndSetBusy({
                    entity: player,
                    action: actions.create.action,
                });
                player = entity as PlayerEntity;
                if (busy) {
                    return {
                        status: "failure",
                        message: "You are busy at the moment.",
                    } as GameCommandResponse;
                }

                try {
                    // Create item
                    const item = (await spawnItem({
                        geohash,
                        prop,
                        variables,
                        owner: player.player, // owner is player
                        configOwner: player.player,
                    })) as Item;
                    return {
                        items: [item],
                        status: "success",
                        op: "upsert",
                    } as GameCommandResponse;
                } catch (error: any) {
                    return {
                        status: "failure",
                        message: error.message,
                    } as GameCommandResponse;
                }
            }),
        // cmd.configureItem
        configureItem: authProcedure
            .input(ConfigureItemSchema)
            .query(async ({ ctx, input }) => {
                const { item, variables } = input;

                // Get player
                let player = (await tryFetchEntity(
                    ctx.user.publicKey,
                )) as PlayerEntity;

                // Check if player is busy
                const { busy, entity } = await checkAndSetBusy({
                    entity: player,
                    action: actions.configure.action,
                });
                player = entity as PlayerEntity;
                if (busy) {
                    return {
                        status: "failure",
                        message: "You are busy at the moment.",
                    } as GameCommandResponse;
                }

                // Get & configure item
                const result = await configureItem({
                    self: player,
                    item: (await tryFetchEntity(item)) as ItemEntity,
                    variables,
                });
                if (result.status === "success") {
                    return {
                        items: [result.item as Item],
                        op: "upsert",
                        status: result.status,
                        message: result.message,
                    } as GameCommandResponse;
                } else {
                    return {
                        status: result.status,
                        message: result.message,
                    } as GameCommandResponse;
                }
            }),
        // cmd.rest
        rest: authProcedure.query(async ({ ctx }) => {
            // Get player
            let player = (await tryFetchEntity(
                ctx.user.publicKey,
            )) as PlayerEntity;

            // Check if player is busy
            const { busy, entity } = await checkAndSetBusy({
                entity: player,
                action: actions.rest.action,
            });
            player = entity as PlayerEntity;
            if (busy) {
                return {
                    status: "failure",
                    message: "You are busy at the moment.",
                } as GameCommandResponse;
            }

            // Rest player
            player.hp = playerStats({ level: player.level }).hp;
            player.mp = playerStats({ level: player.level }).mp;
            player.st = playerStats({ level: player.level }).st;

            // Save player
            await playerRepository.save(player.player, player);

            return {
                players: [player as Player],
                op: "upsert",
                status: "success",
            } as GameCommandResponse;
        }),
    }),
    // Authentication
    auth: t.router({
        // auth.signup
        signup: authProcedure
            .input(SignupSchema)
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
