import { actions, type Actions } from "$lib/crossover/actions";
import {
    autoCorrectGeohashPrecision,
    calculateLocation,
    childrenGeohashes,
    entityDimensions,
    entityId,
    geohashNeighbour,
    getPlotsAtGeohash,
} from "$lib/crossover/utils";
import {
    abilities,
    checkInRange,
    hasResourcesForAbility,
    patchEffectWithVariables,
    type ProcedureEffect,
} from "$lib/crossover/world/abilities";
import {
    bestiary,
    monsterLUReward,
    monsterStats,
} from "$lib/crossover/world/bestiary";
import { biomeAtGeohash, biomes } from "$lib/crossover/world/biomes";
import {
    compendium,
    type EquipmentSlot,
    type ItemVariables,
} from "$lib/crossover/world/compendium";
import { playerStats, type PlayerMetadata } from "$lib/crossover/world/player";
import { MS_PER_TICK } from "$lib/crossover/world/settings";
import type { Direction, WorldAssetMetadata } from "$lib/crossover/world/types";
import { worldSeed } from "$lib/crossover/world/world";
import { serverAnchorClient } from "$lib/server";
import {
    topologyBufferCache,
    topologyResponseCache,
    topologyResultCache,
} from "$lib/server/crossover/caches";
import { parseZodErrors, sleep } from "$lib/utils";
import { PublicKey } from "@solana/web3.js";
import lodash from "lodash";
import { z } from "zod";
import type { UpdateEntitiesEvent } from "../../../routes/api/crossover/stream/+server";
import { ObjectStorage } from "../objectStorage";
import {
    fetchEntity,
    hasCollidersInGeohash,
    isGeohashInWorld,
    itemRepository,
    monsterRepository,
    playerRepository,
    redisClient,
    saveEntity,
    worldRepository,
} from "./redis";
import {
    type Item,
    type ItemEntity,
    type Monster,
    type MonsterEntity,
    type Player,
    type PlayerEntity,
    type WorldEntity,
} from "./redis/entities";
import { type UserMetadataSchema } from "./router";

const { uniqBy } = lodash;

export {
    PlayerStateSchema,
    checkAndSetBusy,
    configureItem,
    connectedUsers,
    consumeResources,
    entityIsBusy,
    getPlayerMetadata,
    getPlayerState,
    getUserMetadata,
    isDirectionTraversable,
    isLocationTraversable,
    itemVariableValue,
    loadPlayerEntity,
    performAbility,
    performEffectOnEntity,
    recoverAp,
    saveEntity,
    savePlayerState,
    setPlayerState,
    spawnItem,
    spawnMonster,
    spawnWorld,
    useItem,
    type ConnectedUser,
    type PlayerState,
};

// PlayerState stores data owned by the game long term (does not require player permission to modify)
type PlayerState = z.infer<typeof PlayerStateSchema>;
const PlayerStateSchema = z.object({
    avatar: z.string().optional(),
    lgn: z.boolean().optional(),
    lum: z.number().optional(),
    umb: z.number().optional(),
    loc: z.array(z.string()).optional(),
    locT: z.enum(["geohash"]).optional(),
    hp: z.number().optional(),
    mp: z.number().optional(),
    st: z.number().optional(),
    ap: z.number().optional(),
    lvl: z.number().optional(),
    buf: z.array(z.string()).optional(),
    dbuf: z.array(z.string()).optional(),
});

/**
 * Interface representing a connected user.
 */
interface ConnectedUser {
    publicKey: string;
    controller: ReadableStreamDefaultController<any>;
}

/**
 * Record of connected users on this server instance.
 */
let connectedUsers: Record<string, ConnectedUser> = {};

/**
 * Retrieves the user metadata for a given public key.
 *
 * @param publicKey The public key of the user.
 * @returns A promise that resolves to the user metadata or null if not found.
 * @throws Error if the user account does not exist or is missing metadata URI.
 */
async function getUserMetadata(
    publicKey: string,
): Promise<z.infer<typeof UserMetadataSchema> | null> {
    const user = await serverAnchorClient.getUser(new PublicKey(publicKey));

    if (user == null) {
        throw new Error(`User account ${publicKey} does not exist`);
    }

    if (!user?.uri) {
        throw new Error(`User account ${publicKey} missing metadata uri`);
    }

    // Load metadata
    let response = await fetch(user.uri);
    const userMetadata: z.infer<typeof UserMetadataSchema> =
        await response.json();

    return userMetadata || null;
}

/**
 * Retrieves the player metadata for a given public key.
 *
 * @param publicKey The public key of the player.
 * @returns A promise that resolves to the player metadata or null if not found.
 */
async function getPlayerMetadata(
    publicKey: string,
): Promise<PlayerMetadata | null> {
    return (await getUserMetadata(publicKey))?.crossover || null;
}

/**
 * Retrieves the player state for a given public key.
 *
 * @param publicKey The public key of the player.
 * @returns A promise that resolves to the player state or null if not found.
 */
async function getPlayerState(publicKey: string): Promise<PlayerState | null> {
    try {
        return await ObjectStorage.getJSONObject({
            owner: publicKey,
            bucket: "player",
            name: publicKey,
        });
    } catch (error: any) {
        return null;
    }
}

/**
 * Sets the player state for a given public key.
 *
 * @param publicKey The public key of the player.
 * @param state The player state to set.
 * @returns A promise that resolves to a string indicating the success of the operation.
 * @throws Error if there is an error parsing the player state.
 */
async function setPlayerState(
    publicKey: string,
    state: PlayerState,
): Promise<string> {
    try {
        return await ObjectStorage.putJSONObject({
            owner: publicKey,
            bucket: "player",
            name: publicKey,
            data: PlayerStateSchema.parse(state),
        });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            throw new Error(JSON.stringify(parseZodErrors(error)));
        } else {
            throw error;
        }
    }
}

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
    // Get player metadata
    const userMetadata = await getUserMetadata(publicKey);
    if (userMetadata == null) {
        throw new Error(`Player ${publicKey} not found`);
    }
    if (userMetadata.crossover == null) {
        throw new Error(`Player ${publicKey} missing crossover metadata`);
    }
    const { avatar, name } = userMetadata.crossover;

    // Merge default, player state, player entity
    let playerEntity = (await fetchEntity(publicKey)) || {};
    let playerState = (await getPlayerState(publicKey)) || {};
    let defaultState: PlayerEntity = {
        player: publicKey,
        name,
        avatar,
        lgn: options.loggedIn,
        loc: [options.geohash],
        locT: "geohash",
        lvl: 1,
        ...playerStats({ level: 1 }),
        apclk: 0,
        buclk: 0,
        dbuf: [],
        buf: [],
        lum: 0,
        umb: 0,
    };
    let player: PlayerEntity = {
        ...defaultState,
        ...playerState,
        ...playerEntity,
        lgn: options.loggedIn,
    };

    // Auto correct player's geohash precision
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
 * Saves the player state (into s3) for a given public key.
 *
 * @param publicKey The public key of the player.
 * @returns A promise that resolves to a string indicating the success of the operation.
 */
async function savePlayerState(publicKey: string): Promise<string> {
    return await setPlayerState(
        publicKey,
        (await playerRepository.fetch(publicKey)) as PlayerState,
    );
}

/**
 * Spawns a monster in a specific geohash.
 *
 * @param geohash The geohash where the monster will be spawned.
 * @param beast The type of monster to spawn.
 * @returns A promise that resolves to the spawned monster entity.
 * @throws Error if the specified beast is not found in the bestiary.
 */
async function spawnMonster({
    geohash,
    beast,
    level,
}: {
    geohash: string;
    beast: string;
    level?: number;
}): Promise<MonsterEntity> {
    // TODO: Calculate level based on geohash and player level in area if not provided
    level ??= 1;

    // Get monster count
    const count = await monsterRepository.search().count();
    const monsterId = `monster_${beast}${count}`; // must start with monster

    // Calculate location
    const { width, height, precision } = bestiary[beast].asset;

    // Auto correct geohash precision
    if (geohash.length !== precision) {
        geohash = autoCorrectGeohashPrecision(geohash, precision);
    }

    // Check location for traversability and colliders
    const location = calculateLocation(geohash, width, height);
    if (!(await isLocationTraversable(location))) {
        throw new Error(`Cannot spawn ${beast} at ${geohash}`);
    }

    // Get monster stats
    const { hp, mp, st, ap } = monsterStats({ level, beast });
    const monster: MonsterEntity = {
        monster: monsterId, // unique monster id
        name: beast,
        beast,
        loc: location,
        locT: "geohash",
        lvl: level,
        hp,
        mp,
        st,
        ap,
        apclk: Date.now(),
        buclk: 0,
        buf: [],
        dbuf: [],
    };
    return (await monsterRepository.save(monsterId, monster)) as MonsterEntity;
}

/**
 * Spawns a world asset from a tiled map in the plot the geohash is in.
 * A plot represents a full grid of 32 geohashes no matter the precision.
 *
 * Note:
 * - World assets must be exact multiples of a plot.
 *
 * @param geohash - The geohash of the world asset.
 * @param assetUrl - The URL of the asset (required to be rendered).
 * @param asset - The world asset object.
 * @param tileHeight - The height of a tile in game (asset tileheight might be different).
 * @param tileWidth - The width of a tile in game (asset tilewidth might be different).
 * @returns A promise that resolves to a WorldEntity.
 */
async function spawnWorld({
    geohash,
    assetUrl,
    asset,
    tileHeight,
    tileWidth,
}: {
    geohash: string;
    assetUrl?: string;
    asset?: WorldAssetMetadata;
    tileHeight: number;
    tileWidth: number;
}): Promise<WorldEntity> {
    // Check asset or assetUrl
    if (!asset && !assetUrl) {
        throw new Error("asset or assetUrl must be provided");
    }

    // Auto correct geohash to unit precision
    if (geohash.length !== worldSeed.spatial.unit.precision) {
        geohash = autoCorrectGeohashPrecision(
            geohash,
            worldSeed.spatial.unit.precision,
        );
    }

    // Get the origin cell of the plot
    geohash = childrenGeohashes(geohash.slice(0, -1))[0];

    // Get asset from URL or if provided
    asset ??= await (await fetch(assetUrl!)).json();
    const {
        height,
        width,
        layers,
        tileheight: assetTileHeight,
        tilewidth: assetTileWidth,
    } = asset!;

    // Check asset dimensions multiples of tile dimensions
    if (
        assetTileWidth % tileWidth !== 0 ||
        assetTileHeight % tileHeight !== 0
    ) {
        throw new Error(
            `Asset tile width and height must be exact multiples of tile width and height`,
        );
    }

    // Get plot geohashes
    const heightMultiplier = assetTileHeight / tileHeight;
    const widthMultiplier = assetTileWidth / tileWidth;
    const plotGeohashes = getPlotsAtGeohash(
        geohash,
        height * heightMultiplier,
        width * widthMultiplier,
    );

    // Get colliders
    let colliders = [];
    for (const { data, properties, width, height } of layers) {
        if (properties == null) {
            continue;
        }
        for (const { name, value } of properties) {
            if (name === "collider" && value === true) {
                // Outer row
                let geohashRow = geohash;
                for (let i = 0; i < height; i++) {
                    // Outer col
                    let geohashCol = geohashRow;
                    for (let j = 0; j < width; j++) {
                        if (data[i * width + j] !== 0) {
                            // Inner row
                            let geohashRowInner = geohashCol;
                            for (let m = 0; m < heightMultiplier; m++) {
                                // Inner col
                                let geohashColInner = geohashRowInner;
                                for (let n = 0; n < widthMultiplier; n++) {
                                    colliders.push(geohashColInner); // add collider
                                    geohashColInner = geohashNeighbour(
                                        geohashColInner,
                                        "e",
                                    );
                                }
                                geohashRowInner = geohashNeighbour(
                                    geohashRowInner,
                                    "s",
                                );
                            }
                        }
                        geohashCol = geohashNeighbour(
                            geohashCol,
                            "e",
                            widthMultiplier,
                        );
                    }
                    geohashRow = geohashNeighbour(
                        geohashRow,
                        "s",
                        heightMultiplier,
                    );
                }
            }
        }
    }

    // Get world count
    const count = await worldRepository.search().count();
    const world = `world_${count}`;

    // Create world asset
    const entity: WorldEntity = {
        world,
        url: assetUrl || "",
        loc: plotGeohashes, // TODO: this can be optimized not just at unit precision -1
        h: height,
        w: width,
        cld: colliders,
    };

    return (await worldRepository.save(world, entity)) as WorldEntity;
}

/**
 * Spawns an item with the given geohash and prop.
 *
 * @param geohash - The geohash for the item.
 * @param prop - The prop in the compendium for the item.
 * @param owner - Who owns or can use the item (player | monster | public (default="") | dm).
 * @param configOwner - Who can configure the item (player | monster | public (default="") | dm).
 * @param variables - The variables for the item.
 * @returns A promise that resolves to the spawned item entity.
 */
async function spawnItem({
    geohash,
    prop,
    variables,
    owner,
    configOwner,
}: {
    geohash: string;
    prop: string;
    owner?: string;
    configOwner?: string;
    variables?: Record<string, any>;
}): Promise<ItemEntity> {
    // Owner defaults to public
    owner ??= "";
    configOwner ??= "";

    // Get item count
    const count = await itemRepository.search().count();
    const item = `item_${prop}${count}`;

    // Get prop
    const { defaultName, defaultState, durability, charges, collider } =
        compendium[prop];
    const { width, height, precision } = compendium[prop].asset;

    // Auto correct geohash precision
    if (geohash.length !== precision) {
        geohash = autoCorrectGeohashPrecision(geohash, precision);
    }

    // Calculate location
    const location = calculateLocation(geohash, width, height);

    // Check location for traversability
    if (!(await isLocationTraversable(location))) {
        throw new Error(`Cannot spawn ${prop} at ${location}`);
    }

    const entity: ItemEntity = {
        item,
        name: defaultName,
        prop,
        loc: location,
        locT: "geohash",
        own: owner,
        cfg: configOwner,
        cld: collider,
        dur: durability,
        chg: charges,
        state: defaultState,
        vars: parseItemVariables(variables || {}, prop),
        dbuf: [],
        buf: [],
    };

    return (await itemRepository.save(item, entity)) as ItemEntity;
}

/**
 * Configures an item by updating its variables based on the provided values.
 *
 * @param self - The entity that is configuring the item.
 * @param item - The item to be configured.
 * @param variables - The new values for the item's variables.
 * @returns A promise that resolves to the updated item entity.
 */
async function configureItem({
    self,
    item,
    variables,
}: {
    self: PlayerEntity | MonsterEntity;
    item: ItemEntity;
    variables: Record<string, any>;
}): Promise<{
    item: ItemEntity;
    status: "success" | "failure";
    message: string;
}> {
    // Check if can configure item
    const { canConfigure, message } = canConfigureItem(self, item);
    if (!canConfigure) {
        return {
            item,
            status: "failure",
            message,
        };
    }

    // Save item with updated variables
    item.vars = {
        ...item.vars,
        ...parseItemVariables(variables, item.prop),
    };
    item = (await itemRepository.save(item.item, item)) as ItemEntity;

    return {
        item,
        status: "success",
        message: "",
    };
}

/**
 * Uses an item by performing the specified utility on the target entity.
 *
 * @param params.item - The item to be used.
 * @param params.utility - The utility to perform on the item.
 * @param params.self - The entity using the item.
 * @param params.target - The target entity for the utility (optional).
 * @returns A promise that resolves to the updated item entity.
 */
async function useItem({
    item,
    utility,
    self,
    target,
}: {
    item: ItemEntity;
    utility: string;
    self: PlayerEntity | MonsterEntity; // sell can only be `player` or `monster`
    target?: PlayerEntity | MonsterEntity | ItemEntity; // target can be an `item`
}): Promise<{
    self: PlayerEntity | MonsterEntity;
    target: PlayerEntity | MonsterEntity | ItemEntity | undefined;
    item: ItemEntity;
    status: "success" | "failure";
    message: string;
}> {
    const selfBefore = { ...self }; // save self before substitution

    // Check if can use item
    const { canUse, message } = canUseItem(self, item, utility);
    if (!canUse) {
        return {
            item,
            self,
            target,
            status: "failure",
            message,
        };
    }

    const prop = compendium[item.prop];
    const propUtility = prop.utilities![utility];
    const propAbility = propUtility.ability;

    // Set item start state
    item.state = propUtility.state.start;
    item = (await itemRepository.save(item.item, item)) as ItemEntity;

    // Publish item state to player
    // TODO: what about other people in the vincinity?
    if (self.player != null) {
        publishAffectedEntitiesToPlayers([self, item]); // non blocking
    }

    // Overwrite target if specified in item variables
    if (prop.variables.target) {
        target = (await itemVariableValue(item, "target")) as
            | PlayerEntity
            | MonsterEntity
            | ItemEntity;
    }

    // Overwrite self if specified in item variables (can only be `player` or `monster`)
    if (prop.variables.self) {
        self = (await itemVariableValue(item, "self")) as
            | PlayerEntity
            | MonsterEntity;
    }

    // Perform ability (ignore cost when using items)
    if (propAbility && target) {
        const {
            self: modifiedSelf,
            target: modifiedTarget,
            status,
            message,
        } = await performAbility({
            self,
            target,
            ability: propAbility,
            ignoreCost: true, // ignore cost when using items
        });

        if (status !== "success") {
            return {
                item,
                self,
                target,
                status: "failure",
                message,
            };
        }

        target = modifiedTarget;
        self = modifiedSelf;
    }

    // Set item end state, consume charges and durability
    item.state = propUtility.state.end;
    item.chg -= propUtility.cost.charges;
    item.dur -= propUtility.cost.durability;
    item = (await itemRepository.save(item.item, item)) as ItemEntity;

    // Publish item state to user (use selfBefore as it might have changed after substitution)
    // TODO: what about other people in the vincinity?
    if (selfBefore.player != null) {
        publishAffectedEntitiesToPlayers([selfBefore, item]); // non blocking
    }

    return {
        item,
        target,
        self,
        status: "success",
        message: "",
    };
}

function canConfigureItem(
    self: PlayerEntity | MonsterEntity,
    item: ItemEntity,
): { canConfigure: boolean; message: string } {
    // Check valid prop
    if (!compendium.hasOwnProperty(item.prop)) {
        return {
            canConfigure: false,
            message: `${item.prop} not found in compendium`,
        };
    }

    // Check if have permissions to configure item
    if (!hasItemConfigOwnerPermissions(item, self)) {
        return {
            canConfigure: false,
            message: `${self.player || self.monster} does not own ${item.item}`,
        };
    }

    return {
        canConfigure: true,
        message: "",
    };
}

function canUseItem(
    self: PlayerEntity | MonsterEntity,
    item: ItemEntity,
    utility: string,
): { canUse: boolean; message: string } {
    // Check valid prop
    if (!compendium.hasOwnProperty(item.prop)) {
        return {
            canUse: false,
            message: `${item.prop} not found in compendium`,
        };
    }
    const prop = compendium[item.prop];

    // Check valid utility
    if (!(prop.utilities && prop.utilities[utility])) {
        return {
            canUse: false,
            message: `Invalid utility ${utility} for item ${item.item}`,
        };
    }

    // Check if have permissions to use item
    if (!hasItemOwnerPermissions(item, self)) {
        return {
            canUse: false,
            message: `${self.player || self.monster} does not own ${item.item}`,
        };
    }

    // Check if utility requires item to be equipped and is equipped in the correct slot
    if (
        prop.utilities[utility].requireEquipped &&
        !compendium[item.prop].equipmentSlot!.includes(
            item.locT as EquipmentSlot,
        )
    ) {
        return {
            canUse: false,
            message: `${item.item} is not equipped in the required slot`,
        };
    }

    // Check has enough charges or durability
    const propUtility = prop.utilities[utility];
    if (item.chg < propUtility.cost.charges) {
        return {
            canUse: false,
            message: `${item.item} has not enough charges to perform ${utility}`,
        };
    }
    if (item.dur < propUtility.cost.durability) {
        return {
            canUse: false,
            message: `${item.item} has not enough durability to perform ${utility}`,
        };
    }

    return {
        canUse: true,
        message: "",
    };
}

function hasItemOwnerPermissions(
    item: ItemEntity,
    self: PlayerEntity | MonsterEntity,
) {
    return (
        item.own === "" || item.own === self.player || item.own === self.monster
    );
}

function hasItemConfigOwnerPermissions(
    item: ItemEntity,
    self: PlayerEntity | MonsterEntity,
) {
    return (
        item.cfg === "" || item.cfg === self.player || item.cfg === self.monster
    );
}

function parseItemVariables(
    variables: ItemVariables,
    prop: string,
): ItemVariables {
    const propVariables = compendium[prop].variables;

    let itemVariables: ItemVariables = {};

    for (const [key, value] of Object.entries(variables)) {
        if (propVariables.hasOwnProperty(key)) {
            const { type } = propVariables[key];
            if (["string", "item", "monster", "player"].includes(type)) {
                itemVariables[key] = String(value);
            } else if (type === "number") {
                itemVariables[key] = Number(value);
            } else if (type === "boolean") {
                itemVariables[key] = Boolean(value);
            }
        }
    }

    return itemVariables;
}

async function itemVariableValue(
    item: ItemEntity,
    key: string,
): Promise<
    string | number | boolean | PlayerEntity | MonsterEntity | ItemEntity
> {
    const itemVariables = item.vars;
    const propVariables = compendium[item.prop].variables;

    const { type } = propVariables[key];
    const variable = itemVariables[key];

    if (type === "item") {
        return (await itemRepository.fetch(variable as string)) as ItemEntity;
    } else if (type === "player") {
        return (await playerRepository.fetch(
            variable as string,
        )) as PlayerEntity;
    } else if (type === "monster") {
        return (await monsterRepository.fetch(
            variable as string,
        )) as MonsterEntity;
    } else if (type === "string") {
        return String(variable);
    } else if (type === "number") {
        return Number(variable);
    } else if (type === "boolean") {
        return Boolean(variable);
    }

    throw new Error(`Invalid variable type ${type} for item ${item.item}`);
}

async function performActionConsequences({
    selfBefore,
    targetBefore,
    selfAfter,
    targetAfter,
}: {
    selfBefore: PlayerEntity | MonsterEntity;
    targetBefore: PlayerEntity | MonsterEntity | ItemEntity;
    selfAfter: PlayerEntity | MonsterEntity;
    targetAfter: PlayerEntity | MonsterEntity | ItemEntity;
}): Promise<{
    self: PlayerEntity | MonsterEntity;
    target: PlayerEntity | MonsterEntity | ItemEntity;
}> {
    // Player initiated action
    if (selfBefore.player && selfBefore.player == selfAfter.player) {
        selfAfter = selfAfter as PlayerEntity;
        // Target is a player
        if (targetBefore.player && targetBefore.player == targetAfter.player) {
        }
        // Target is a monster
        else if (
            targetBefore.monster &&
            targetBefore.monster == targetAfter.monster
        ) {
            targetBefore = targetBefore as MonsterEntity;
            targetAfter = targetAfter as MonsterEntity;
            // Player kills monster
            if (targetBefore.hp > 0 && targetAfter.hp <= 0) {
                // Give player rewards
                const { lumina, umbra } = monsterLUReward({
                    level: targetBefore.lvl,
                    beast: targetBefore.beast,
                });
                selfAfter.lum += lumina;
                selfAfter.umb += umbra;
                // Save & publish player
                selfAfter = (await saveEntity(selfAfter)) as PlayerEntity;
                publishAffectedEntitiesToPlayers([selfAfter]); // non blocking
            }
        }
    }
    // Monster initiated action
    else if (selfBefore.monster && selfBefore.monster == selfAfter.monster) {
        // Target is a player
        if (targetBefore.player && targetBefore.player == targetAfter.player) {
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

async function performAbility({
    self,
    target,
    ability,
    ignoreCost,
}: {
    self: PlayerEntity | MonsterEntity; // self can only be a `player` or `monster`
    target: PlayerEntity | MonsterEntity | ItemEntity; // target can be an `item`
    ability: string;
    ignoreCost?: boolean;
}): Promise<{
    self: PlayerEntity | MonsterEntity;
    target: PlayerEntity | MonsterEntity | ItemEntity;
    status: "success" | "failure";
    message: string;
}> {
    const { procedures, ap, mp, st, hp, range, predicate } = abilities[ability];

    // Recover AP
    self = await recoverAp(self);

    // Check if self has enough resources to perform ability
    if (!ignoreCost) {
        const { hasResources, message } = hasResourcesForAbility(self, ability);
        if (!hasResources) {
            return {
                self,
                target,
                status: "failure",
                message,
            };
        }
    }

    // Check predicate
    if (
        !predicate.targetSelfAllowed &&
        entityId(self)[0] === entityId(target)[0]
    ) {
        return {
            self,
            target,
            status: "failure",
            message: `You can't ${ability} yourself`,
        };
    }

    // Check if target is in range
    if (!checkInRange(self, target, range)) {
        return {
            self,
            target,
            status: "failure",
            message: "Target is out of range",
        };
    }

    // Check if player is busy
    const { busy, entity } = await checkAndSetBusy({
        entity: self as PlayerEntity,
        ability,
    });
    self = entity; // update `buclk`
    if (self.player && busy) {
        return {
            self,
            target,
            status: "failure",
            message: "You are busy at the moment.",
        };
    }

    // Save old self and target
    const selfBefore = { ...self };
    const targetBefore = { ...target };

    // Expend ability costs (also caps stats to player level)
    if (!ignoreCost) {
        self = await consumeResources(self, { ap, mp, st, hp });
    }
    target = target.player === self.player ? self : target; // target might be self, in which case update it after save

    // Publish ability costs changes to player
    if (self.player && !ignoreCost) {
        publishAffectedEntitiesToPlayers([self]); // non blocking
    }

    // Perform procedures
    for (const [type, effect] of procedures) {
        // Get affected entity (self or target)
        let entity = effect.target === "self" ? self : target;

        // Action
        if (type === "action") {
            // Patch effect with variables
            const actualEffect = patchEffectWithVariables({
                effect,
                self,
                target,
            });

            // Perform effect action (will block for the duration (ticks) of the effect)
            entity = (await performEffectOnEntity({
                entity,
                effect: actualEffect,
            })) as PlayerEntity | MonsterEntity | ItemEntity;
            await saveEntity(entity);

            // Update self or target
            if (effect.target === "self") {
                self = entity as PlayerEntity | MonsterEntity;
            } else {
                target = entity as PlayerEntity | MonsterEntity | ItemEntity;
            }

            // Publish effect & effected entities to relevant players (non blocking)
            if (self.player || entity.player) {
                publishAffectedEntitiesToPlayers([self, target]);
            }
        }
        // Check
        else if (type === "check") {
            if (!performEffectCheck({ entity, effect })) break;
        }
    }

    // Perform action consequences
    const changes = await performActionConsequences({
        targetBefore,
        selfBefore,
        selfAfter: self,
        targetAfter: target,
    });
    self = changes.self;
    target = changes.target;

    return { self, target, status: "success", message: "" };
}

async function performEffectOnEntity({
    entity,
    effect,
}: {
    entity: Player | Monster | Item;
    effect: ProcedureEffect;
}): Promise<Player | Monster | Item> {
    // Note: this will change entity in place

    // Sleep for the duration of the effect
    await sleep(effect.ticks * MS_PER_TICK);

    // Damage
    if (effect.damage) {
        // Player or monster
        if ((entity as Player).player || (entity as Monster).monster) {
            (entity as Player | Monster).hp = Math.max(
                0,
                (entity as Player | Monster).hp - effect.damage.amount,
            );
        }
        // Item
        else if ((entity as Item).item) {
            (entity as Item).dur = Math.max(
                0,
                (entity as Item).dur - effect.damage.amount,
            );
        }
    }

    // Debuff
    if (effect.debuffs) {
        const { debuff, op } = effect.debuffs;
        if (op === "push") {
            if (!entity.dbuf.includes(debuff)) {
                entity.dbuf.push(debuff);
            }
        } else if (op === "pop") {
            entity.dbuf = entity.dbuf.filter((d) => d !== debuff);
        }
    }

    // State
    if (effect.states) {
        const { state, op, value } = effect.states;
        if (entity.hasOwnProperty(state)) {
            if (op === "change") {
                (entity as any)[state] = value;
            } else if (op === "subtract" && state) {
                (entity as any)[state] -= value as number;
            } else if (op === "add") {
                (entity as any)[state] += value as number;
            }

            // Patch location (if the location dimensions have changed beyond the asset's dimensions)
            if (state === "loc") {
                const { width, height, precision } = entityDimensions(entity);
                if (entity[state].length !== width * height) {
                    entity[state] = calculateLocation(
                        entity[state][0],
                        width,
                        height,
                    );
                }
            }
        }
    }

    return entity;
}

function performEffectCheck({
    entity,
    effect,
}: {
    entity: PlayerEntity | MonsterEntity | ItemEntity;
    effect: ProcedureEffect;
}): boolean {
    const { debuffs, buffs } = effect;

    if (debuffs) {
        const { debuff, op } = debuffs;
        if (op === "contains") {
            return entity.dbuf.includes(debuff);
        } else if (op === "doesNotContain") {
            return !entity.dbuf.includes(debuff);
        }
    }

    if (buffs) {
        const { buff, op } = buffs;
        if (op === "contains") {
            return entity.buf.includes(buff);
        } else if (op === "doesNotContain") {
            return !entity.buf.includes(buff);
        }
    }

    return false;
}

async function publishAffectedEntitiesToPlayers(
    entities: (PlayerEntity | MonsterEntity | ItemEntity)[],
) {
    const effectedPlayers = uniqBy(
        entities.filter((entity) => entity.player),
        "player",
    );
    const effectedMonsters = uniqBy(
        entities.filter((entity) => entity.monster),
        "monster",
    );
    const effectedItems = uniqBy(
        entities.filter((entity) => entity.item),
        "item",
    );

    // Publish effects to players
    for (const p of effectedPlayers) {
        await redisClient.publish(
            (p as Player).player,
            JSON.stringify({
                event: "entities",
                players: effectedPlayers,
                monsters: effectedMonsters,
                items: effectedItems,
            } as UpdateEntitiesEvent),
        );
    }
}

async function isDirectionTraversable(
    entity: PlayerEntity | MonsterEntity,
    direction: Direction,
): Promise<[boolean, string[]]> {
    let location: string[] = [];

    // Check all cells are able to move (location might include more than 1 cell for large entities)
    for (const geohash of entity.loc) {
        const nextGeohash = geohashNeighbour(geohash, direction);

        // Within own location is always traversable
        if (entity.loc.includes(nextGeohash)) {
            location.push(nextGeohash);
            continue;
        }

        // Check if geohash is traversable
        if (!(await isGeohashTraversable(nextGeohash))) {
            return [false, entity.loc]; // early return if not traversable
        } else {
            location.push(nextGeohash);
        }
    }
    return [true, location];
}

async function isGeohashTraversable(geohash: string): Promise<boolean> {
    const inWorld = await isGeohashInWorld(geohash);
    const [biome, strength] = await biomeAtGeohash(geohash, {
        topologyResultCache,
        topologyBufferCache,
        topologyResponseCache,
    });

    // Check if biome is traversable (ignore if user is in a world)
    if (!inWorld && biomes[biome].traversableSpeed <= 0) {
        return false;
    }
    // Get colliders in geohash
    if (await hasCollidersInGeohash(geohash)) {
        return false;
    }
    return true;
}

async function isLocationTraversable(location: string[]): Promise<boolean> {
    for (const geohash of location) {
        if (!(await isGeohashTraversable(geohash))) {
            return false;
        }
    }
    return true;
}

function entityIsBusy(entity: Player | Monster): [boolean, number] {
    const now = Date.now();
    if (entity.buclk > now) {
        return [true, now];
    }
    return [false, now];
}

async function checkAndSetBusy({
    entity,
    action,
    ability,
}: {
    entity: PlayerEntity | MonsterEntity;
    action?: Actions;
    ability?: string;
}): Promise<{ busy: Boolean; entity: PlayerEntity | MonsterEntity }> {
    // Check if entity is busy
    const [isBusy, now] = entityIsBusy(entity);
    if (isBusy) {
        return { busy: true, entity };
    }

    // Action
    if (action != null && actions[action].ticks > 0) {
        const ms = actions[action].ticks * MS_PER_TICK;
        entity.buclk = now + ms;
        return {
            busy: false,
            entity: (await saveEntity(entity)) as PlayerEntity,
        };
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
            return {
                busy: false,
                entity: (await saveEntity(entity)) as PlayerEntity,
            };
        }
    }
    return {
        busy: false,
        entity,
    };
}

async function recoverAp(
    entity: PlayerEntity | MonsterEntity,
): Promise<PlayerEntity | MonsterEntity> {
    const maxAp = entity.player
        ? playerStats({ level: entity.lvl }).ap
        : monsterStats({
              level: entity.lvl,
              beast: (entity as MonsterEntity).beast,
          }).ap;

    if (entity.ap < maxAp) {
        const now = Date.now();
        entity.ap = Math.min(
            maxAp,
            Math.floor(entity.ap + (now - entity.apclk) / MS_PER_TICK),
        );
        entity.apclk = now; // reset ap clock after recovery
        return (await saveEntity(entity)) as PlayerEntity | MonsterEntity;
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
    }: {
        ap?: number;
        mp?: number;
        st?: number;
        hp?: number;
    },
): Promise<PlayerEntity | MonsterEntity> {
    // Get max stats (also fixes stats when it goes over max)
    const {
        ap: maxAp,
        hp: maxHp,
        st: maxSt,
        mp: maxMp,
    } = entity.player
        ? playerStats({ level: entity.lvl })
        : monsterStats({
              level: entity.lvl,
              beast: (entity as MonsterEntity).beast,
          });

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
        entity.apclk = Date.now();
    }

    return (await saveEntity(entity)) as PlayerEntity;
}
