import { autoCorrectGeohashPrecision } from "$lib/crossover/utils";
import type { Abilities } from "$lib/crossover/world/abilities";
import { type Actions } from "$lib/crossover/world/actions";
import { entityStats } from "$lib/crossover/world/entity";
import { LOCATION_INSTANCE, MS_PER_TICK } from "$lib/crossover/world/settings";
import { abilities } from "$lib/crossover/world/settings/abilities";
import { actions } from "$lib/crossover/world/settings/actions";
import { worldSeed } from "$lib/crossover/world/settings/world";
import {
    GeohashLocationSchema,
    geohashLocationTypes,
    type LocationType,
} from "$lib/crossover/world/types";
import {
    type CreatureEntity,
    type PlayerEntity,
} from "$lib/server/crossover/types";
import { COUNTRY_DETAILS } from "$lib/userDeviceClient/defs";
import { z } from "zod";
import { getPlayerState, getUser } from "../user";
import { resolveEquipment } from "./combat/equipment";
import { respawnPlayer } from "./combat/utils";
import { fetchEntity, saveEntity } from "./redis/utils";

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
    loc: z.array(z.string()).optional(),
    locT: GeohashLocationSchema.optional(),
    hp: z.number().optional(),
    mnd: z.number().optional(),
    cha: z.number().optional(),
    lum: z.number().optional(),
    umb: z.number().optional(),
    cond: z.array(z.string()).optional(), // ['${a|p}:${Condition}:${validTill}'] eg. ['a:burning:123456']
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
        locationType?: LocationType;
    },
): Promise<PlayerEntity> {
    // Get user metadata
    const userMetadata = await getUser(publicKey);
    if (userMetadata == null) {
        throw new Error(`User ${publicKey} not found`);
    }
    if (userMetadata.crossover == null) {
        throw new Error(`Player ${publicKey} not found`);
    }

    const { avatar, name, demographic, npc } = userMetadata.crossover;
    const locationType = options.locationType ?? "geohash";
    const locationInstance = options.locationInstance ?? LOCATION_INSTANCE;

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
        locT: locationType,
        locI: locationInstance,
        wgt: 0,
        hp: 0,
        mnd: 0,
        cha: 0,
        lum: 0,
        umb: 0,
        buclk: 0,
        cond: [],
        arch: demographic.archetype,
        gen: demographic.gender,
        race: demographic.race,
        fac: "historian", // new human players automatically start in the "Guild of the Historians"
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

    // Fix any misconfigured region or geohash
    if (!COUNTRY_DETAILS[player.rgn]) {
        player.rgn = options.region;
        player = await respawnPlayer(player); // respawn player (to his sancuary)
    }

    // Auto correct player's geohash precision (try fix if corrupted, unstuck player)
    if (
        geohashLocationTypes.has(player.locT) &&
        player.loc[0].length !== worldSeed.spatial.unit.precision
    ) {
        player.loc = [
            autoCorrectGeohashPrecision(
                player.loc[0],
                worldSeed.spatial.unit.precision,
            ),
        ];
        player.locT = locationType;
    }

    // Apply equipment enhancements (incl. weight, conditions, set bonuses etc ...)
    player = await resolveEquipment(player);

    return player;
}

async function setEntityBusy<T extends CreatureEntity>({
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
    entity: CreatureEntity,
    {
        cha,
        mnd,
        umb,
        lum,
        hp,
    }: {
        cha?: number;
        mnd?: number;
        umb?: number;
        lum?: number;
        hp?: number;
    },
    save: boolean = true,
): Promise<CreatureEntity> {
    // Get max stats (also fixes stats when it goes over max)
    const { hp: maxHp, mnd: maxSt, cha: maxCha } = entityStats(entity);

    if (cha) {
        entity.cha = Math.max(Math.min(maxCha, entity.cha - cha), 0);
    }
    if (mnd) {
        entity.mnd = Math.max(Math.min(maxSt, entity.mnd - mnd), 0);
    }
    if (hp) {
        entity.hp = Math.max(Math.min(maxHp, entity.hp - hp), 0);
    }
    if (lum) {
        entity.lum = Math.max(entity.lum - lum, 0);
    }
    if (umb) {
        entity.umb = Math.max(entity.umb - umb, 0);
    }
    if (save) {
        entity = await saveEntity(entity);
    }
    return entity;
}
