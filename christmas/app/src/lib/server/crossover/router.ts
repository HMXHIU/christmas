import { PUBLIC_REFRESH_JWT_EXPIRES_IN } from "$env/static/public";
import { PlayerMetadataSchema } from "$lib/crossover/world/player";
import { TILE_HEIGHT, TILE_WIDTH } from "$lib/crossover/world/settings";
import { worldSeed } from "$lib/crossover/world/settings/world";
import { SkillLinesEnum } from "$lib/crossover/world/skills";
import {
    GeohashLocationSchema,
    type GeohashLocationType,
} from "$lib/crossover/world/types";
import {
    dungeonEntrancesQuerySet,
    fetchEntity,
    initializeClients,
    playerRepository,
    saveEntity,
    worldsInGeohashQuerySet,
} from "$lib/server/crossover/redis";
import { PublicKey } from "@solana/web3.js";
import { TRPCError } from "@trpc/server";
import { performance } from "perf_hooks";
import { z } from "zod";
import { loadPlayerEntity } from ".";
import {
    FEE_PAYER_PUBKEY,
    createSerializedTransaction,
    hashObject,
    serverAnchorClient,
} from "..";
import { ObjectStorage } from "../objectStorage";
import {
    authProcedure,
    dmServiceProcedure,
    internalServiceProcedure,
    t,
} from "../trpc";
import { performAbility } from "./abilities";
import {
    configureItem,
    createItem,
    dropItem,
    enterItem,
    equipItem,
    learn,
    moveEntity,
    performInventory,
    performLook,
    rest,
    say,
    takeItem,
    unequipItem,
    useItem,
} from "./actions";
import {
    initializeGame,
    spawnMonster,
    spawnMonsters,
    spawnWorld,
} from "./dungeonMaster";
import { probeEquipment } from "./player";
import { loggedInPlayersQuerySet } from "./redis";
import type {
    Item,
    ItemEntity,
    MonsterEntity,
    Player,
    PlayerEntity,
    World,
    WorldEntity,
} from "./redis/entities";
import {
    entityIsBusy,
    getPlayerState,
    getUserMetadata,
    publishFeedEvent,
    savePlayerState,
} from "./utils";

export { SaySchema, UserMetadataSchema, crossoverRouter };

// Initialize redis clients, repositiories, indexes
initializeClients();

// Schemas - auth
const LoginSchema = z.object({
    geohash: z.string(),
    region: z.string(),
});

// Schemas - cmd
const SaySchema = z.object({
    message: z.string(),
    target: z.string().optional(),
});
const LearnSchema = z.object({
    teacher: z.string(),
    skill: z.enum(SkillLinesEnum),
});
const LookSchema = z.object({
    target: z.string().optional(),
});
const PathSchema = z.object({
    path: z.array(
        z.enum(["n", "s", "e", "w", "ne", "nw", "se", "sw", "u", "d"]),
    ),
});
const EntityPathSchema = PathSchema.extend({
    entity: z.string(),
});
const PerformAbilitySchema = z.object({
    ability: z.string(),
    target: z.string(),
});
const EntityPerformAbilitySchema = PerformAbilitySchema.extend({
    entity: z.string(),
});
const UseItemSchema = z.object({
    item: z.string(),
    utility: z.string(),
    target: z.string().optional(),
});
const TargetItemSchema = z.object({
    item: z.string(),
});
const TargetPlayerSchema = z.object({
    player: z.string(),
});
const ConfigureItemSchema = z.object({
    item: z.string(),
    variables: z.record(z.union([z.string(), z.number(), z.boolean()])),
});
const CreateItemSchema = z.object({
    geohash: z.string(), // TODO: if not provided, item is created in player inventory
    locationType: GeohashLocationSchema,
    prop: z.string(),
    variables: z
        .record(z.union([z.string(), z.number(), z.boolean()]))
        .optional(),
});

// Schemas - world
const SpawnMonsterSchema = z.object({
    geohash: z.string(),
    locationType: GeohashLocationSchema,
    locationInstance: z.string(),
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
    locationType: GeohashLocationSchema,
    tilemap: z.string(), // tilemap in `PUBLIC_TILED_MINIO_BUCKET` bucket
});

// Schemas - player
const EquipItemSchema = z.object({
    item: z.string(),
    slot: z.enum([
        "rh",
        "lh",
        "ft",
        "hd",
        "nk",
        "ch",
        "lg",
        "r1",
        "r2",
        "sh",
        "gl",
    ]), // TODO: dont hardcode this?
});

const UserMetadataSchema = z.object({
    publicKey: z.string(),
    crossover: PlayerMetadataSchema.optional(),
});

const playerAuthProcedure = authProcedure.use(async ({ ctx, next }) => {
    const player = (await tryFetchEntity(ctx.user.publicKey)) as PlayerEntity;
    if (!player) {
        throw new TRPCError({
            code: "NOT_FOUND",
            message: "Player not found",
        });
    }
    return next({
        ctx: {
            ...ctx,
            player,
        },
    });
});

const playerAuthBusyProcedure = playerAuthProcedure.use(
    async ({ ctx, next }) => {
        const [isBusy, now] = entityIsBusy(ctx.player);
        if (isBusy) {
            publishFeedEvent(ctx.player.player, {
                type: "error",
                message: "You are busy at the moment.",
            });

            // Throw a TRPCError to abort the procedure
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Player is busy",
            });
        }
        return next({
            ctx: {
                ...ctx,
                now,
            },
        });
    },
);

// Router
const crossoverRouter = {
    //  Dungeon master (requires dm token)
    dm: t.router({
        moveMonster: dmServiceProcedure
            .input(EntityPathSchema)
            .mutation(async ({ ctx, input }) => {
                const { path, entity } = input;
                await moveEntity(
                    (await fetchEntity(entity)) as PlayerEntity | MonsterEntity,
                    path,
                );
            }),
        performMonsterAbility: dmServiceProcedure
            .input(EntityPerformAbilitySchema)
            .mutation(async ({ ctx, input }) => {
                const { ability, target, entity } = input;
                await performAbility({
                    self: (await fetchEntity(entity)) as
                        | PlayerEntity
                        | MonsterEntity,
                    target,
                    ability,
                });
            }),
        initialize: internalServiceProcedure.mutation(async () => {
            await initializeGame();
        }),
        respawnMonsters: internalServiceProcedure.mutation(async () => {
            const start = performance.now();
            // Get all logged in players
            const players =
                (await loggedInPlayersQuerySet().return.all()) as PlayerEntity[];

            await spawnMonsters(players);

            const end = performance.now();
            return { status: "success", time: end - start };
        }),
        spawnMonster: dmServiceProcedure
            .input(SpawnMonsterSchema)
            .mutation(async ({ input }) => {
                const {
                    geohash,
                    level,
                    beast,
                    locationType,
                    locationInstance,
                } = input;

                // Check geohash is unit precision
                if (geohash.length !== worldSeed.spatial.unit.precision) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: `Geohash must be unit precision`,
                    });
                }

                const monster = await spawnMonster({
                    geohash,
                    beast,
                    locationType,
                    locationInstance,
                });
                return monster;
            }),
        spawnWorld: dmServiceProcedure
            .input(SpawnWorldSchema)
            .mutation(async ({ input }) => {
                const { geohash, tilemap, locationType } = input;
                const assetUrl = ObjectStorage.objectUrl({
                    owner: null,
                    bucket: "tiled",
                    name: `tilemaps/${tilemap}`,
                });
                const world = await spawnWorld({
                    geohash,
                    locationType,
                    assetUrl,
                    tileHeight: TILE_HEIGHT,
                    tileWidth: TILE_WIDTH,
                });
                return world as World;
            }),
        buffEntity: dmServiceProcedure
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
                fetchedEntity.lvl = level ?? fetchedEntity.lvl;
                fetchedEntity.hp = hp ?? fetchedEntity.hp;
                fetchedEntity.mp = mp ?? fetchedEntity.mp;
                fetchedEntity.st = st ?? fetchedEntity.st;
                fetchedEntity.ap = ap ?? fetchedEntity.ap;
                fetchedEntity.buf = buffs ?? fetchedEntity.buf;
                fetchedEntity.dbuf = debuffs ?? fetchedEntity.dbuf;

                // Save entity
                return await saveEntity(fetchedEntity);
            }),
    }),
    // World
    world: t.router({
        poi: playerAuthProcedure.query(async ({ ctx }) => {
            const { player } = ctx;
            const territory = player.loc[0].slice(
                0,
                worldSeed.spatial.territory.precision,
            );

            const dungeonEntrances: Item[] = (await dungeonEntrancesQuerySet(
                territory,
                player.locT as GeohashLocationType,
            ).all()) as ItemEntity[];

            return {
                territory,
                dungeonEntrances,
            };
        }),
        worlds: authProcedure
            .input(
                z.object({
                    geohash: z.string(),
                    locationType: GeohashLocationSchema,
                }),
            )
            .query(async ({ input }) => {
                let { geohash, locationType } = input;
                const town = geohash.slice(0, worldSeed.spatial.town.precision);
                const worlds = (await worldsInGeohashQuerySet(
                    [town],
                    locationType,
                ).return.all()) as WorldEntity[];

                // TODO: hash worlds and have API to check world hashes if need for invalidation
                return {
                    town,
                    worlds: worlds as World[],
                };
            }),
    }),
    // Player
    player: t.router({
        // player.metadata
        metadata: authProcedure.query(async ({ ctx }) => {
            return await getUserMetadata(ctx.user.publicKey);
        }),
        // player.inventory
        inventory: playerAuthProcedure.query(async ({ ctx }) => {
            await performInventory(ctx.player);
        }),
        // player.probeEquipment (TODO: not used, deprecate?)
        probeEquipment: playerAuthProcedure
            .input(TargetPlayerSchema)
            .query(async ({ ctx, input }) => {
                await probeEquipment(ctx.player, input.player);
            }),
    }),
    // Commands
    cmd: t.router({
        // cmd.take
        take: playerAuthBusyProcedure
            .input(TargetItemSchema)
            .query(async ({ ctx, input }) => {
                const { item } = input;
                await takeItem(ctx.player, item, ctx.now);
            }),
        // cmd.equip
        equip: playerAuthBusyProcedure
            .input(EquipItemSchema)
            .query(async ({ ctx, input }) => {
                const { item, slot } = input;
                await equipItem(ctx.player, item, slot, ctx.now);
            }),
        // cmd.unequip
        unequip: playerAuthBusyProcedure
            .input(TargetItemSchema)
            .query(async ({ ctx, input }) => {
                const { item } = input;
                await unequipItem(ctx.player, item, ctx.now);
            }),
        // cmd.drop
        drop: playerAuthBusyProcedure
            .input(TargetItemSchema)
            .query(async ({ ctx, input }) => {
                const { item } = input;
                await dropItem(ctx.player, item, ctx.now);
            }),
        // cmd.say
        say: playerAuthBusyProcedure
            .input(SaySchema)
            .query(async ({ ctx, input }) => {
                await say(ctx.player, input.message, {
                    target: input.target,
                    now: ctx.now,
                });
            }),
        learn: playerAuthBusyProcedure
            .input(LearnSchema)
            .query(async ({ ctx, input }) => {
                const { skill, teacher } = input;
                await learn(ctx.player, teacher, skill);
            }),
        // cmd.look
        look: playerAuthBusyProcedure
            .input(LookSchema)
            .query(async ({ ctx, input }) => {
                await performLook(ctx.player, { inventory: true });
            }),
        // cmd.move
        move: playerAuthBusyProcedure
            .input(PathSchema)
            .query(async ({ ctx, input }) => {
                const { path } = input;
                await moveEntity(ctx.player, path, ctx.now);
            }),
        // cmd.performAbility
        performAbility: playerAuthBusyProcedure
            .input(PerformAbilitySchema)
            .query(async ({ ctx, input }) => {
                const { ability, target } = input;
                await performAbility({
                    self: ctx.player,
                    target,
                    ability,
                    now: ctx.now,
                });
            }),
        // cmd.useItem
        useItem: playerAuthBusyProcedure
            .input(UseItemSchema)
            .query(async ({ ctx, input }) => {
                const { item, utility, target } = input;
                await useItem({
                    self: ctx.player,
                    item,
                    target,
                    utility,
                    now: ctx.now,
                });
            }),
        // cmd.createItem
        createItem: playerAuthBusyProcedure
            .input(CreateItemSchema)
            .query(async ({ ctx, input }) => {
                const { geohash, prop, variables } = input;
                await createItem(ctx.player, geohash, prop, variables, ctx.now);
            }),
        // cmd.configureItem
        configureItem: playerAuthBusyProcedure
            .input(ConfigureItemSchema)
            .query(async ({ ctx, input }) => {
                const { item, variables } = input;
                await configureItem(ctx.player, item, variables, ctx.now);
            }),
        // cmd.enterItem
        enterItem: playerAuthBusyProcedure
            .input(TargetItemSchema)
            .query(async ({ ctx, input }) => {
                const { item } = input;
                await enterItem(ctx.player, item, ctx.now);
            }),
        // cmd.rest
        rest: playerAuthBusyProcedure.query(async ({ ctx }) => {
            await rest(ctx.player, ctx.now);
        }),
    }),
    // Authentication
    auth: t.router({
        // auth.signup
        signup: authProcedure
            .input(PlayerMetadataSchema)
            .mutation(async ({ ctx, input }) => {
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

                // Get user metadata
                let userMetadata = await getUserMetadata(ctx.user.publicKey);

                // Check if player metadata (userMetadata.crossover) already exists
                if (userMetadata?.crossover != null) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: `Player ${ctx.user.publicKey} already exists (storage)`,
                    });
                }

                // Parse & validate player metadata
                const playerMetadata = await PlayerMetadataSchema.parse(input);

                // Check that avatar exists
                const { demographic, appearance, avatar } = playerMetadata;
                const avatarFileName = avatar.split("/").slice(-1)[0];
                if (
                    !(await ObjectStorage.objectExists({
                        owner: null,
                        bucket: "avatar",
                        name: avatarFileName,
                    }))
                ) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: `Avatar does not exist`,
                    });
                }

                // Update user metadata with player metadata
                userMetadata = await UserMetadataSchema.parse({
                    ...userMetadata,
                    crossover: playerMetadata,
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

                // Get or load player entity
                let player = await loadPlayerEntity(ctx.user.publicKey, {
                    geohash,
                    region,
                    loggedIn: true,
                });

                // Save player state & entity
                player = (await playerRepository.save(
                    ctx.user.publicKey,
                    player,
                )) as PlayerEntity;
                await savePlayerState(ctx.user.publicKey); // must save after player entity

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

            // Logout & save player state
            player.lgn = false;
            await playerRepository.save(player.player, player);
            await savePlayerState(ctx.user.publicKey);

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
                (await fetchEntity(ctx.user.publicKey)) ||
                (await getPlayerState(ctx.user.publicKey));

            if (player == null) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: `Player ${ctx.user.publicKey} is not initialized`,
                });
            }

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
