import { type MonsterEntity, type PlayerEntity } from "$lib/crossover/types";
import { autoCorrectGeohashPrecision } from "$lib/crossover/utils";
import type { Abilities } from "$lib/crossover/world/abilities";
import { type Actions } from "$lib/crossover/world/actions";
import { entityStats } from "$lib/crossover/world/entity";
import { LOCATION_INSTANCE, MS_PER_TICK } from "$lib/crossover/world/settings";
import { abilities } from "$lib/crossover/world/settings/abilities";
import { actions } from "$lib/crossover/world/settings/actions";
import { worldSeed } from "$lib/crossover/world/settings/world";
import { GeohashLocationSchema } from "$lib/crossover/world/types";
import { z } from "zod";
import { fetchEntity, saveEntity } from "./redis/utils";
import { getPlayerState, getUserMetadata } from "./utils";

export {
    connectedUsers,
    consumeResources,
    loadPlayerEntity,
    LOOK_PAGE_SIZE,
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
    options: {
        geohash: string;
        region: string;
        loggedIn: boolean;
        locationInstance?: string;
    },
): Promise<PlayerEntity> {
    // Get user metadata
    const userMetadata = await getUserMetadata(publicKey);
    if (userMetadata == null) {
        throw new Error(`Player ${publicKey} not found`);
    }
    if (userMetadata.crossover == null) {
        throw new Error(`Player ${publicKey} missing crossover metadata`);
    }
    const { avatar, name, demographic, npc } = userMetadata.crossover;

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
        locI: options.locationInstance ?? LOCATION_INSTANCE,
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
        npc,
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

async function setEntityBusy<T extends PlayerEntity | MonsterEntity>({
    entity,
    action,
    ability,
    now,
    duration,
}: {
    entity: T;
    action?: Actions;
    ability?: Abilities;
    now?: number;
    duration?: number;
}): Promise<T> {
    // Check if entity is busy
    now = now ?? Date.now();

    // Duration provided
    if (duration != null) {
        entity.buclk = now + duration;
        return await saveEntity(entity);
    }
    // Action
    else if (action != null && actions[action].ticks > 0) {
        const ms = actions[action].ticks * MS_PER_TICK;
        entity.buclk = now + ms;
        return await saveEntity(entity);
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
            return await saveEntity(entity);
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
