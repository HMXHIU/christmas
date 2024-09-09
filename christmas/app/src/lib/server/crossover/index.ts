import { autoCorrectGeohashPrecision } from "$lib/crossover/utils";
import { actions, type Actions } from "$lib/crossover/world/actions";
import { monsterLUReward } from "$lib/crossover/world/bestiary";
import { entityStats } from "$lib/crossover/world/entity";
import { LOCATION_INSTANCE, MS_PER_TICK } from "$lib/crossover/world/settings";
import { abilities } from "$lib/crossover/world/settings/abilities";
import { sanctuaries, worldSeed } from "$lib/crossover/world/settings/world";
import { GeohashLocationSchema } from "$lib/crossover/world/types";
import { z } from "zod";
import { fetchEntity, saveEntity } from "./redis";
import {
    type ItemEntity,
    type MonsterEntity,
    type Player,
    type PlayerEntity,
} from "./redis/entities";
import {
    getPlayerState,
    getUserMetadata,
    publishAffectedEntitiesToPlayers,
    publishFeedEvent,
} from "./utils";

export {
    connectedUsers,
    consumeResources,
    loadPlayerEntity,
    LOOK_PAGE_SIZE,
    performActionConsequences,
    PlayerStateSchema,
    setEntityBusy,
    type ConnectedUser,
    type PlayerState,
};

const LOOK_PAGE_SIZE = 20;

// PlayerState stores data owned by the game long term (does not require player permission to modify)
type PlayerState = z.infer<typeof PlayerStateSchema>;
const PlayerStateSchema = z.object({
    avatar: z.string().optional(),
    lgn: z.boolean().optional(),
    lum: z.number().optional(),
    umb: z.number().optional(),
    loc: z.array(z.string()).optional(),
    locT: GeohashLocationSchema.optional(),
    hp: z.number().optional(),
    mp: z.number().optional(),
    st: z.number().optional(),
    ap: z.number().optional(),
    buf: z.array(z.string()).optional(),
    dbuf: z.array(z.string()).optional(),
});

interface ConnectedUser {
    publicKey: string;
    controller: ReadableStreamDefaultController<any>;
}

// Record of connected users on this server instance.
let connectedUsers: Record<string, ConnectedUser> = {};

/**
 * Loads the player entity (PlayerMetadata + PlayerState) for a given public key.
 *
 * @param publicKey The public key of the player.
 * @returns A promise that resolves to the loaded player entity.
 * @throws Error if the player is not found.
 */
async function loadPlayerEntity(
    publicKey: string,
    options: { geohash: string; region: string; loggedIn: boolean },
): Promise<PlayerEntity> {
    // Get user metadata
    const userMetadata = await getUserMetadata(publicKey);
    if (userMetadata == null) {
        throw new Error(`Player ${publicKey} not found`);
    }
    if (userMetadata.crossover == null) {
        throw new Error(`Player ${publicKey} missing crossover metadata`);
    }
    const { avatar, name, demographic } = userMetadata.crossover;

    // Merge default, player state, player entity
    let playerEntity = (await fetchEntity(publicKey)) || {};
    let playerState = (await getPlayerState(publicKey)) || {};
    let defaultState: PlayerEntity = {
        player: publicKey,
        name,
        avatar,
        lgn: options.loggedIn,
        rgn: options.region,
        loc: [options.geohash],
        locT: "geohash",
        locI: LOCATION_INSTANCE,
        hp: 0,
        mp: 0,
        st: 0,
        ap: 0,
        apclk: 0,
        buclk: 0,
        dbuf: [],
        buf: [],
        lum: 0,
        umb: 0,
        arch: demographic.archetype,
        gen: demographic.gender,
        race: demographic.race,
        skills: {},
        pthclk: 0,
        pthdur: 0,
        pth: [],
        pthst: "",
    };
    defaultState = { ...defaultState, ...entityStats(defaultState) };

    let player: PlayerEntity = {
        ...defaultState,
        ...playerState,
        ...playerEntity,
        lgn: options.loggedIn,
    };

    // Auto correct player's geohash precision (try fix if corrupted, unstuck player)
    if (player.loc[0].length !== worldSeed.spatial.unit.precision) {
        player.loc = [
            autoCorrectGeohashPrecision(
                player.loc[0],
                worldSeed.spatial.unit.precision,
            ),
        ];
        player.locT = "geohash";
        console.log("Auto corrected player's location", player.loc);
    }

    return player;
}

/**
 * Handles the event when a player kills a monster.
 *
 * @param player - The player entity.
 * @param monster - The monster entity.
 */
async function handlePlayerKillsMonster(
    player: PlayerEntity,
    monster: MonsterEntity,
    playersNearby: string[],
) {
    // Note: changes player, monster in place
    // Give player rewards
    const { lumina, umbra } = monsterLUReward(monster);
    player.lum += lumina;
    player.umb += umbra;
    // Save & publish player
    player = (await saveEntity(player)) as PlayerEntity;
    publishAffectedEntitiesToPlayers([player]); // publish full entity to self
}

/**
 * Handles the scenario where a monster kills a player.
 *
 * @param monster - The monster entity.
 * @param player - The player entity.
 */
async function handleMonsterKillsPlayer(
    monster: MonsterEntity,
    player: PlayerEntity,
    playersNearby: string[],
) {
    // Get player's sanctuary
    const sanctuary = sanctuaries.find((s) => s.region === player.rgn);
    if (!sanctuary) {
        throw new Error(`${player.player} has no sanctuary`);
    }

    player = {
        ...player,
        // Recover all stats
        ...entityStats(player),
        // Respawn at player's region
        loc: [sanctuary.geohash],
        // Lose half exp
        umb: Math.floor(player.lum / 2),
        lum: Math.floor(player.umb / 2),
    };

    publishFeedEvent(player.player, {
        type: "message",
        message: "You died.",
    });
    // Save & publish player
    player = (await saveEntity(player)) as PlayerEntity;
    publishAffectedEntitiesToPlayers([player], { publishTo: playersNearby });
}

async function performActionConsequences({
    selfBefore,
    targetBefore,
    selfAfter,
    targetAfter,
    playersNearby,
}: {
    selfBefore: PlayerEntity | MonsterEntity;
    targetBefore: PlayerEntity | MonsterEntity | ItemEntity;
    selfAfter: PlayerEntity | MonsterEntity;
    targetAfter: PlayerEntity | MonsterEntity | ItemEntity;
    playersNearby: string[];
}): Promise<{
    self: PlayerEntity | MonsterEntity;
    target: PlayerEntity | MonsterEntity | ItemEntity;
}> {
    // Player initiated action
    if (selfBefore.player && selfBefore.player == selfAfter.player) {
        // Target is a player
        if (targetBefore.player && targetBefore.player == targetAfter.player) {
        }
        // Target is a monster
        else if (
            targetBefore.monster &&
            targetBefore.monster == targetAfter.monster
        ) {
            if (
                (targetBefore as MonsterEntity).hp > 0 &&
                (targetAfter as MonsterEntity).hp <= 0
            ) {
                await handlePlayerKillsMonster(
                    selfAfter as PlayerEntity,
                    targetAfter as MonsterEntity,
                    playersNearby,
                );
            }
        }
    }
    // Monster initiated action
    else if (selfBefore.monster && selfBefore.monster == selfAfter.monster) {
        // Target is a player
        if (targetBefore.player && targetBefore.player == targetAfter.player) {
            if (
                (targetBefore as Player).hp > 0 &&
                (targetAfter as Player).hp <= 0
            ) {
                await handleMonsterKillsPlayer(
                    selfAfter as MonsterEntity,
                    targetAfter as PlayerEntity,
                    playersNearby,
                );
            }
        }
        // Target is a monster
        else if (
            targetBefore.monster &&
            targetBefore.monster == targetAfter.monster
        ) {
        }
    }

    return { self: selfAfter, target: targetAfter };
}

async function setEntityBusy({
    entity,
    action,
    ability,
    now,
    duration,
}: {
    entity: PlayerEntity | MonsterEntity;
    action?: Actions;
    ability?: string;
    now?: number;
    duration?: number;
}): Promise<PlayerEntity | MonsterEntity> {
    // Check if entity is busy
    now = now ?? Date.now();

    // Duration provided
    if (duration != null) {
        entity.buclk = now + duration;
        return (await saveEntity(entity)) as PlayerEntity | MonsterEntity;
    }
    // Action
    else if (action != null && actions[action].ticks > 0) {
        const ms = actions[action].ticks * MS_PER_TICK;
        entity.buclk = now + ms;
        return (await saveEntity(entity)) as PlayerEntity | MonsterEntity;
    }
    // Ability
    else if (ability != null) {
        const ticks = abilities[ability].procedures.reduce(
            (acc, [type, effect]) => acc + effect.ticks,
            0,
        );
        if (ticks > 0) {
            const ms = ticks * MS_PER_TICK;
            entity.buclk = now + ms;
            return (await saveEntity(entity)) as PlayerEntity | MonsterEntity;
        }
    }
    return entity;
}

async function consumeResources(
    entity: PlayerEntity | MonsterEntity,
    {
        ap,
        mp,
        st,
        hp,
        now,
    }: {
        ap?: number;
        mp?: number;
        st?: number;
        hp?: number;
        now?: number;
    },
): Promise<PlayerEntity | MonsterEntity> {
    now = now ?? Date.now();

    // Get max stats (also fixes stats when it goes over max)
    const { ap: maxAp, hp: maxHp, st: maxSt, mp: maxMp } = entityStats(entity);

    if (ap != null && ap !== 0) {
        entity.ap = Math.max(Math.min(maxAp, entity.ap - ap), 0);
    }
    if (mp != null && mp !== 0) {
        entity.mp = Math.max(Math.min(maxMp, entity.mp - mp), 0);
    }
    if (st != null && st !== 0) {
        entity.st = Math.max(Math.min(maxSt, entity.st - st), 0);
    }
    if (hp != null && hp !== 0) {
        entity.hp = Math.max(Math.min(maxHp, entity.hp - hp), 0);
    }

    // Set AP clock (if consumed)
    if (ap != null && ap > 0) {
        entity.apclk = now;
    }

    return (await saveEntity(entity)) as PlayerEntity;
}
