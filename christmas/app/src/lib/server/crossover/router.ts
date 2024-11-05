import {
    PUBLIC_GAME_BUCKET,
    PUBLIC_REFRESH_JWT_EXPIRES_IN,
} from "$env/static/public";
import type { Item, Monster, Player, World } from "$lib/crossover/types";
import { PlayerMetadataSchema } from "$lib/crossover/world/player";
import { TILE_HEIGHT, TILE_WIDTH } from "$lib/crossover/world/settings";
import {
    fetchSanctuaries,
    worldSeed,
} from "$lib/crossover/world/settings/world";
import { SkillLinesEnum } from "$lib/crossover/world/skills";
import {
    BarterSchema,
    GeohashLocationSchema,
    type GeohashLocation,
} from "$lib/crossover/world/types";
import {
    fetchEntity,
    fetchQuest,
    saveEntity,
} from "$lib/server/crossover/redis/utils";
import type {
    ActorEntity,
    CreatureEntity,
    ItemEntity,
    MonsterEntity,
    PlayerEntity,
    WorldEntity,
} from "$lib/server/crossover/types";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { loadPlayerEntity } from ".";
import { ObjectStorage } from "../objectStorage";
import { authProcedure, dmServiceProcedure, t } from "../trpc";
import { performAbility } from "./abilities";
import { fulfill, inventory, look, move, rest, say } from "./actions";
import { createGiveCTA, executeGiveCTA } from "./actions/give";
import {
    configureItem,
    createItem,
    dropItem,
    enterItem,
    equipItem,
    takeItem,
    unequipItem,
    useItem,
} from "./actions/item";
import { createLearnCTA, executeLearnCTA } from "./actions/learn";
import {
    browse,
    createTradeCTA,
    createTradeWrit,
    deserializeBarter,
    executeTradeCTA,
} from "./actions/trade";
import { respawnMonsters, spawnLocation, spawnMonster, spawnWorld } from "./dm";
import { publishCTAEvent, publishFeedEvent } from "./events";
import {
    verifyP2PTransaction,
    type P2PGiveTransaction,
    type P2PLearnTransaction,
    type P2PTradeTransaction,
} from "./player";

import { ELEVATION_TO_CELL_HEIGHT } from "$lib/components/crossover/Game/settings";
import type { Quest } from "$lib/crossover/types";
import {
    childrenGeohashesAtPrecision,
    geohashToColRow,
} from "$lib/crossover/utils";
import { AbilitiesEnum } from "$lib/crossover/world/abilities";
import {
    biomeAtGeohash,
    elevationAtGeohash,
} from "$lib/crossover/world/biomes";
import { entityAbilities } from "$lib/crossover/world/entity";
import {
    getOrCreatePlayer,
    getPlayerState,
    getUser,
    savePlayerState,
} from "../user";
import { attack } from "./actions/attack";
import { capture } from "./actions/capture";
import {
    biomeAtGeohashCache,
    biomeParametersAtCityCache,
    dungeonGraphCache,
    dungeonsAtTerritoryCache,
    topologyBufferCache,
    topologyResponseCache,
    topologyResultCache,
} from "./caches";
import {
    dungeonEntrancesQuerySet,
    worldsInGeohashQuerySet,
} from "./redis/queries";
import { entityIsBusy } from "./utils";

export {
    BuffCreatureSchema,
    crossoverRouter,
    EntityPerformAbilitySchema,
    EntityTargetEntitySchema,
    RespawnMonstersSchema,
    SaySchema,
    SkillsSchema,
    SpawnMonsterSchema,
};

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
const GiveSchema = z.object({
    receiver: z.string(),
    item: z.string(),
});
const TradeSchema = z.object({
    seller: z.string(),
    buyer: z.string(),
    offer: BarterSchema,
    receive: BarterSchema,
});
const CaptureSchema = z.object({
    target: z.string(),
    offer: BarterSchema,
});
const AcceptSchema = z.object({
    token: z.string(), // jwt token
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
    ability: z.enum(AbilitiesEnum),
    target: z.string().optional(),
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
const TargetEntitySchema = z.object({
    target: z.string(),
});
const EntityTargetEntitySchema = TargetEntitySchema.extend({
    entity: z.string(),
});
const ConfigureItemSchema = z.object({
    item: z.string(),
    variables: z.record(z.union([z.string(), z.number(), z.boolean()])),
});
const CreateItemSchema = z.object({
    prop: z.string(),
    variables: z
        .record(z.union([z.string(), z.number(), z.boolean()]))
        .optional(),
});
const RespawnMonstersSchema = z.object({
    locationInstance: z.string().optional(),
    players: z.array(z.string()).optional(),
});

// Schemas - world
const SkillsSchema = z.record(z.enum(SkillLinesEnum), z.number());
const SpawnMonsterSchema = z.object({
    geohash: z.string(),
    locationType: GeohashLocationSchema,
    locationInstance: z.string(),
    beast: z.string(),
    additionalSkills: SkillsSchema.optional(),
});
const BuffCreatureSchema = z.object({
    entity: z.string(),
    hp: z.number().optional(),
    cha: z.number().optional(),
    mnd: z.number().optional(),
    lum: z.number().optional(),
    umb: z.number().optional(),
});
const SpawnWorldSchema = z.object({
    geohash: z.string(),
    locationType: GeohashLocationSchema,
    locationInstance: z.string().optional(), // defaults to @
    tilemap: z.string(), // in minio bucket `game/worlds/tilemaps/${tilemap}`
});

// Schemas - player
const EquipItemSchema = z.object({
    item: z.string(),
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
            // Publish error feed
            await publishFeedEvent(ctx.player.player, {
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
                await move((await fetchEntity(entity)) as CreatureEntity, path);
            }),
        performMonsterAbility: dmServiceProcedure
            .input(EntityPerformAbilitySchema)
            .mutation(async ({ ctx, input }) => {
                const { ability, target, entity } = input;
                await performAbility({
                    self: (await fetchEntity(entity)) as CreatureEntity,
                    target,
                    ability,
                });
            }),
        performMonsterAttack: dmServiceProcedure
            .input(EntityTargetEntitySchema)
            .mutation(async ({ ctx, input }) => {
                const { target, entity } = input;
                const monsterEntity = (await fetchEntity(
                    entity,
                )) as MonsterEntity;
                await attack(monsterEntity, target);
            }),
        respawnMonsters: dmServiceProcedure
            .input(RespawnMonstersSchema)
            .mutation(async ({ ctx, input }) => {
                const { locationInstance, players } = input;
                return await respawnMonsters({
                    players,
                    locationInstance,
                });
            }),
        spawnMonster: dmServiceProcedure
            .input(SpawnMonsterSchema)
            .mutation(async ({ input }) => {
                const {
                    geohash,
                    beast,
                    locationType,
                    locationInstance,
                    additionalSkills,
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
                    additionalSkills,
                });
                return monster as Monster;
            }),
        spawnWorld: dmServiceProcedure
            .input(SpawnWorldSchema)
            .mutation(async ({ input }) => {
                const { geohash, tilemap, locationType, locationInstance } =
                    input;
                const assetUrl = ObjectStorage.objectUrl({
                    owner: null,
                    bucket: PUBLIC_GAME_BUCKET,
                    name: `worlds/tilemaps/${tilemap}`,
                });
                const world = await spawnWorld({
                    geohash,
                    locationType,
                    locationInstance: locationInstance ?? "@",
                    assetUrl,
                    tileHeight: TILE_HEIGHT,
                    tileWidth: TILE_WIDTH,
                });
                return world as World;
            }),
        monsterAbilities: dmServiceProcedure
            .input(SkillsSchema)
            .mutation(({ input }) => {
                return entityAbilities({ skills: input });
            }),
        buffCreature: dmServiceProcedure
            .input(BuffCreatureSchema)
            .mutation(async ({ input }) => {
                const { entity, hp, cha, lum, umb, mnd } = input;

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
                fetchedEntity.mnd = mnd ?? fetchedEntity.mnd;
                fetchedEntity.cha = cha ?? fetchedEntity.cha;
                fetchedEntity.lum = lum ?? fetchedEntity.lum;
                fetchedEntity.umb = umb ?? fetchedEntity.umb;

                // Save entity
                return await saveEntity(fetchedEntity);
            }),
    }),
    // World
    world: t.router({
        biomes: dmServiceProcedure
            .input(
                z.object({
                    village: z
                        .string()
                        .length(worldSeed.spatial.village.precision),
                    locationType: GeohashLocationSchema,
                }),
            )
            .mutation(async ({ ctx, input }) => {
                const { village, locationType } = input;
                const biomes: Record<
                    string,
                    {
                        biome: string;
                        elevation: number;
                        col: number;
                        row: number;
                    }
                > = {};

                for (const g of childrenGeohashesAtPrecision(
                    village,
                    worldSeed.spatial.unit.precision,
                )) {
                    const [biome, strength] = await biomeAtGeohash(
                        g,
                        locationType,
                        {
                            topologyResponseCache,
                            topologyResultCache,
                            topologyBufferCache,
                            biomeAtGeohashCache,
                            biomeParametersAtCityCache,
                            dungeonGraphCache,
                            dungeonsAtTerritoryCache,
                        },
                    );
                    const elevation =
                        (await elevationAtGeohash(g, locationType, {
                            responseCache: topologyResponseCache,
                            resultsCache: topologyResultCache,
                            bufferCache: topologyBufferCache,
                        })) * ELEVATION_TO_CELL_HEIGHT;

                    const [col, row] = geohashToColRow(g);

                    biomes[g] = {
                        biome,
                        elevation,
                        col,
                        row,
                    };
                }

                return biomes;
            }),
        poi: playerAuthProcedure.query(async ({ ctx }) => {
            const { player } = ctx;
            const territory = player.loc[0].slice(
                0,
                worldSeed.spatial.territory.precision,
            );

            const dungeonEntrances: Item[] = (await dungeonEntrancesQuerySet(
                territory,
                player.locT as GeohashLocation,
                player.locI,
            ).all()) as ItemEntity[];

            const sancturaries = (await fetchSanctuaries()).filter((s) =>
                s.geohash.startsWith(territory),
            );

            return {
                territory,
                sancturaries,
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
            return await getUser(ctx.user.publicKey);
        }),
        // player.inventory
        inventory: playerAuthProcedure.query(async ({ ctx }) => {
            await inventory(ctx.player);
        }),
        // player.quest
        quest: playerAuthProcedure
            .input(TargetItemSchema)
            .query(async ({ ctx, input }) => {
                const { item } = input;

                // Check player has item
                const questWrit = (await fetchEntity(item)) as ItemEntity;
                if (questWrit.loc[0] !== ctx.player.player) {
                    throw new Error(
                        `${questWrit.item} does not belong to ${ctx.player.player}`,
                    );
                }
                // Check quest
                const quest = await fetchQuest(questWrit.vars.quest as string);
                if (!quest) {
                    throw new Error(
                        `Quest in ${questWrit.item} does not exist`,
                    );
                }

                return quest as Quest;
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
                await equipItem(ctx.player, input.item, ctx.now);
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
        // cmd.fulfill
        fulfill: playerAuthBusyProcedure
            .input(TargetItemSchema)
            .query(async ({ ctx, input }) => {
                await fulfill(ctx.player, input.item);
            }),
        // cmd.accept
        accept: playerAuthBusyProcedure
            .input(AcceptSchema)
            .query(async ({ ctx, input }) => {
                const p2pTransaction = await verifyP2PTransaction(input.token);
                // Learn
                if (p2pTransaction.transaction === "learn") {
                    await executeLearnCTA(
                        ctx.player,
                        p2pTransaction as P2PLearnTransaction,
                    );
                }
                // Trade
                else if (p2pTransaction.transaction === "trade") {
                    await executeTradeCTA(
                        ctx.player,
                        p2pTransaction as P2PTradeTransaction,
                    );
                }
                // Give
                else if (p2pTransaction.transaction === "give") {
                    await executeGiveCTA(
                        ctx.player,
                        p2pTransaction as P2PGiveTransaction,
                    );
                }
            }),

        // cmd.give
        give: playerAuthBusyProcedure
            .input(GiveSchema)
            .query(async ({ ctx, input }) => {
                const { item, receiver } = input;
                const receiverEntity = (await fetchEntity(
                    receiver,
                )) as PlayerEntity;
                const itemEntity = (await fetchEntity(item)) as ItemEntity;
                await publishCTAEvent(receiver, {
                    cta: await createGiveCTA(
                        ctx.player,
                        receiverEntity,
                        itemEntity,
                    ),
                });
            }),
        // cmd.learn
        learn: playerAuthBusyProcedure
            .input(LearnSchema)
            .query(async ({ ctx, input }) => {
                const { skill, teacher } = input;
                const teacherEntity = (await fetchEntity(
                    teacher,
                )) as PlayerEntity;
                await publishCTAEvent(teacher, {
                    cta: await createLearnCTA(ctx.player, teacherEntity, skill),
                });
            }),
        // cmd.writ
        writ: playerAuthBusyProcedure
            .input(TradeSchema)
            .query(async ({ ctx, input }) => {
                const { buyer, seller, offer, receive } = input;

                // TODO: What about buy writs targetting props instead of exact item instances ?

                // Creates a trade writ in the player's inventory
                await createTradeWrit({
                    creator: ctx.player,
                    buyer,
                    seller,
                    offer: await deserializeBarter(offer),
                    receive: await deserializeBarter(receive),
                });
            }),
        // cmd.browse
        browse: playerAuthBusyProcedure
            .input(TargetPlayerSchema)
            .query(async ({ ctx, input }) => {
                await browse(ctx.player, input.player);
            }),
        // cmd.trade
        trade: playerAuthBusyProcedure
            .input(TradeSchema)
            .query(async ({ ctx, input }) => {
                const { buyer, seller, offer, receive } = input;
                const sellerEntity = (await fetchEntity(
                    seller,
                )) as PlayerEntity;
                const buyerEntity = (await fetchEntity(buyer)) as PlayerEntity;

                // Player wants to sell to buyer (send CTA offer to buyer for execution)
                if (ctx.player.player === seller) {
                    await publishCTAEvent(buyer, {
                        cta: await createTradeCTA(
                            ctx.player,
                            buyerEntity,
                            sellerEntity,
                            await deserializeBarter(offer),
                            await deserializeBarter(receive),
                        ),
                    });
                }
                // Player wants to buy from seller (send CTA offer to seller for execution)
                else if (ctx.player.player === buyer) {
                    await publishCTAEvent(seller, {
                        cta: await createTradeCTA(
                            ctx.player,
                            buyerEntity,
                            sellerEntity,
                            await deserializeBarter(offer),
                            await deserializeBarter(receive),
                        ),
                    });
                }
                // Check that the executor must be one of the parties
                else {
                    await publishFeedEvent(ctx.player.player, {
                        type: "error",
                        message: `You try to execute the agreement, but it rejects you with a slight jolt.`,
                    });
                    return;
                }
            }),
        // cmd.look
        look: playerAuthBusyProcedure
            .input(LookSchema)
            .query(async ({ ctx, input }) => {
                await look(ctx.player, { inventory: true });
            }),
        // cmd.move
        move: playerAuthBusyProcedure
            .input(PathSchema)
            .query(async ({ ctx, input }) => {
                await move(ctx.player, input.path, ctx.now);
            }),
        // cmd.attack
        attack: playerAuthBusyProcedure
            .input(TargetEntitySchema)
            .query(async ({ ctx, input }) => {
                const { target } = input;
                await attack(ctx.player, target, { now: ctx.now });
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
                const { prop, variables } = input;
                await createItem(ctx.player, prop, variables, ctx.now);
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
        // cmd.capture
        capture: playerAuthBusyProcedure
            .input(CaptureSchema)
            .query(async ({ ctx, input }) => {
                const { offer, target } = input;
                await capture({
                    self: ctx.player,
                    target,
                    offer: await deserializeBarter(offer),
                });
            }),
    }),
    // Authentication
    auth: t.router({
        // auth.signup
        signup: authProcedure
            .input(PlayerMetadataSchema)
            .mutation(async ({ ctx, input }) => {
                const playerMetadata = await getOrCreatePlayer(
                    ctx.user.publicKey,
                    input,
                );

                // Set player cookie (to know if user has signed up for crossover)
                ctx.cookies.set("player", ctx.user.publicKey, {
                    path: "/",
                    httpOnly: true,
                    secure: true,
                    sameSite: "strict",
                    maxAge: parseInt(PUBLIC_REFRESH_JWT_EXPIRES_IN), // in seconds
                });

                return playerMetadata;
            }),
        // auth.login
        login: authProcedure
            .input(LoginSchema)
            .query(async ({ ctx, input }) => {
                const { geohash, region } = input;

                // Load player entity
                let player = await loadPlayerEntity(ctx.user.publicKey, {
                    geohash,
                    region,
                    loggedIn: true,
                });

                // Spawn location (Do not block, spawn in the background)
                spawnLocation(
                    player.loc[0],
                    player.locT as GeohashLocation,
                    player.locI,
                );

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
        // auth.logout
        logout: authProcedure.query(async ({ ctx }) => {
            // Get player
            let player = (await tryFetchEntity(
                ctx.user.publicKey,
            )) as PlayerEntity;

            // Logout & save player state
            player.lgn = false;
            player = await saveEntity(player);
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

async function tryFetchEntity(entity: string): Promise<ActorEntity> {
    const fetchedEntity = await fetchEntity(entity);
    if (fetchedEntity == null) {
        throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Entity ${entity} not found`,
        });
    }
    return fetchedEntity;
}
