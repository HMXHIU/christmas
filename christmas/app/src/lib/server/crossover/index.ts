import {
    MS_PER_TICK,
    childrenGeohashes,
    worldSeed,
} from "$lib/crossover/world";
import {
    abilities,
    canPerformAbility,
    checkInRange,
    fillInEffectVariables,
    type ProcedureEffect,
} from "$lib/crossover/world/abilities";
import { monsterStats } from "$lib/crossover/world/bestiary";
import {
    compendium,
    type ItemVariables,
} from "$lib/crossover/world/compendium";
import { playerStats } from "$lib/crossover/world/player";
import { serverAnchorClient } from "$lib/server";
import { parseZodErrors, sleep } from "$lib/utils";
import { PublicKey } from "@solana/web3.js";
import type { Search } from "redis-om";
import { z } from "zod";
import type { MessageFeed } from "../../../routes/api/crossover/stream/+server";
import { ObjectStorage } from "../objectStorage";
import {
    isEntityBusy,
    itemRepository,
    monsterRepository,
    playerRepository,
    redisClient,
    setEnityBusy,
} from "./redis";
import {
    type ItemEntity,
    type MonsterEntity,
    type PlayerEntity,
} from "./redis/entities";
import {
    PlayerStateSchema,
    type PlayerMetadataSchema,
    type UserMetadataSchema,
} from "./router";

export {
    configureItem,
    connectedUsers,
    getPlayerMetadata,
    getUserMetadata,
    initPlayerEntity,
    itemVariableValue,
    loadPlayerEntity,
    loggedInPlayersQuerySet,
    monstersInGeohashQuerySet,
    performAbility,
    playersInGeohashQuerySet,
    saveEntity,
    savePlayerEntityState,
    setPlayerState,
    spawnItem,
    spawnMonster,
    updatedItemVariables,
    useItem,
    type ConnectedUser,
};

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
 * @param publicKey The public key of the player.
 * @returns A promise that resolves to the player metadata or null if not found.
 */
async function getPlayerMetadata(
    publicKey: string,
): Promise<z.infer<typeof PlayerMetadataSchema> | null> {
    return (await getUserMetadata(publicKey))?.crossover || null;
}

/**
 * Retrieves the player state for a given public key.
 * @param publicKey The public key of the player.
 * @returns A promise that resolves to the player state or null if not found.
 */
async function getPlayerState(
    publicKey: string,
): Promise<z.infer<typeof PlayerStateSchema> | null> {
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
 * @param publicKey The public key of the player.
 * @param state The player state to set.
 * @returns A promise that resolves to a string indicating the success of the operation.
 * @throws Error if there is an error parsing the player state.
 */
async function setPlayerState(
    publicKey: string,
    state: z.infer<typeof PlayerStateSchema>,
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
 * @param publicKey The public key of the player.
 * @param playerState Upsert player state if provided.
 * @returns A promise that resolves to the loaded player entity.
 * @throws Error if the player is not found.
 */
async function loadPlayerEntity(
    publicKey: string,
    playerState: any = {},
): Promise<PlayerEntity> {
    // Get player metadata
    const playerMetadata = await getPlayerMetadata(publicKey);
    if (playerMetadata == null) {
        throw new Error(`Player ${publicKey} not found`);
    }

    // Get & update player state
    const newPlayerState = {
        ...((await getPlayerState(publicKey)) || {}),
        ...playerState,
    };
    await setPlayerState(publicKey, newPlayerState);

    return (await playerRepository.save(publicKey, {
        ...playerMetadata,
        ...newPlayerState,
    })) as PlayerEntity;
}

/**
 * Initializes the player entity.
 * @param player The player entity.
 * @param region The region of the player.
 * @param geohash The geohash of the player.
 * @param forceSave Indicates whether to force save the player entity.
 * @returns A promise that resolves to the initialized player entity.
 */
async function initPlayerEntity(
    {
        player,
        region,
        geohash,
    }: {
        player: PlayerEntity;
        region: string;
        geohash: string;
    },
    { forceSave }: { forceSave: boolean } = { forceSave: false },
): Promise<PlayerEntity> {
    let changed = false;

    // Initialize geohash
    if (!player.geohash) {
        // TODO: Spawn player in region's city center spawn point
        player.geohash = geohash;
        changed = true;
    }

    // Initialize level and stats
    if (!player.level) {
        player.level = 1;
        const { hp, mp, st, ap } = playerStats({ level: player.level });
        player.hp = hp;
        player.mp = mp;
        player.st = st;
        player.ap = ap;
        player.debuffs = [];
        player.buffs = [];
        changed = true;
        console.log("Initialized player's level and stats", player.player);
    }

    // Auto correct player's geohash precision
    if (player.geohash.length !== worldSeed.spatial.unit.precision) {
        const delta = worldSeed.spatial.unit.precision - player.geohash.length;
        let geohash = player.geohash;
        if (delta > 0) {
            for (let i = 0; i < delta; i++) {
                geohash = childrenGeohashes(geohash)[0];
            }
        } else if (delta < 0) {
            geohash = geohash.slice(0, worldSeed.spatial.unit.precision);
        }
        player.geohash = geohash;
        console.log("Auto corrected player's geohash", player.geohash);
    }

    // Save if changed or `forceSave`
    if (changed || forceSave) {
        player = (await playerRepository.save(
            player.player,
            player,
        )) as PlayerEntity;
    }

    return player;
}

/**
 * Saves the player entity state (into s3) for a given public key.
 * @param publicKey The public key of the player.
 * @returns A promise that resolves to a string indicating the success of the operation.
 */
async function savePlayerEntityState(publicKey: string): Promise<string> {
    return await setPlayerState(
        publicKey,
        (await playerRepository.fetch(publicKey)) as PlayerEntity,
    );
}

/**
 * Returns a search query set for logged in players.
 * @returns A search query set for logged in players.
 */
function loggedInPlayersQuerySet(): Search {
    return playerRepository.search().where("loggedIn").equal(true);
}

/**
 * Returns a search query set for players in a specific geohash.
 * @param geohash The geohash to filter players by.
 * @returns A search query set for players in the specified geohash.
 */
function playersInGeohashQuerySet(geohash: string): Search {
    // TODO: this should include all children geohashes
    return loggedInPlayersQuerySet().and("geohash").equal(geohash);
}

/**
 * Returns a search query set for monsters in a specific geohash.
 * @param geohash The geohash to filter monsters by.
 * @returns A search query set for monsters in the specified geohash.
 */
function monstersInGeohashQuerySet(geohash: string): Search {
    return monsterRepository.search().where("geohash").eq(`${geohash}*`);
}

/**
 * Spawns a monster in a specific geohash.
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

    // Get monster stats
    const { hp, mp, st, ap } = monsterStats({ level, beast });
    const monster: MonsterEntity = {
        monster: monsterId, // unique monster id
        name: beast,
        beast,
        geohash,
        level,
        hp,
        mp,
        st,
        ap,
        buffs: [],
        debuffs: [],
    };
    return (await monsterRepository.save(monsterId, monster)) as MonsterEntity;
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

    const entity: ItemEntity = {
        item,
        name: compendium[prop].defaultName,
        prop,
        geohash,
        owner,
        configOwner,
        durability: compendium[prop].durability,
        charges: compendium[prop].charges,
        state: compendium[prop].defaultState,
        variables: JSON.stringify(parseItemVariables(variables || {}, prop)),
        debuffs: [],
        buffs: [],
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
        // TODO: publish to player message
        console.log(message);
        return {
            item,
            status: "failure",
            message,
        };
    }

    // Save item with updated variables
    item.variables = updatedItemVariables(item, variables);
    item = (await itemRepository.save(item.item, item)) as ItemEntity;

    return {
        item,
        status: "success",
        message: "",
    };
}

/**
 * Saves the given entity to the appropriate repository.
 *
 * @param entity - The entity to be saved.
 * @returns A promise that resolves to the saved entity.
 */
async function saveEntity(
    entity: PlayerEntity | MonsterEntity | ItemEntity,
): Promise<PlayerEntity | MonsterEntity | ItemEntity> {
    if (entity.player) {
        return (await playerRepository.save(
            (entity as PlayerEntity).player,
            entity,
        )) as PlayerEntity;
    } else if (entity.monster) {
        return (await monsterRepository.save(
            (entity as MonsterEntity).monster,
            entity,
        )) as MonsterEntity;
    } else if (entity.item) {
        return (await itemRepository.save(
            (entity as ItemEntity).item,
            entity,
        )) as ItemEntity;
    }
    throw new Error("Invalid entity");
}

/**
 * Uses an item by performing the specified action on the target entity.
 *
 * @param params.item - The item to be used.
 * @param params.action - The action to perform on the item.
 * @param params.self - The entity using the item.
 * @param params.target - The target entity for the action (optional).
 * @returns A promise that resolves to the updated item entity.
 */
async function useItem({
    item,
    action,
    self,
    target,
}: {
    item: ItemEntity;
    action: string;
    self: PlayerEntity | MonsterEntity; // sell can only be `player` or `monster`
    target?: PlayerEntity | MonsterEntity | ItemEntity; // target can be an `item`
}): Promise<{
    self: PlayerEntity | MonsterEntity;
    target: PlayerEntity | MonsterEntity | ItemEntity | undefined;
    item: ItemEntity;
    status: "success" | "failure";
    message: string;
}> {
    // Check if can use item
    const { canUse, message } = canUseItem(self, item, action);
    if (!canUse) {
        // TODO: publish to player message
        console.log(message);
        return {
            item,
            self,
            target,
            status: "failure",
            message,
        };
    }

    const prop = compendium[item.prop];
    const propAction = prop.actions![action];
    const propAbility = propAction.ability;

    // Set item start state
    item.state = propAction.state.start;
    item = (await itemRepository.save(item.item, item)) as ItemEntity;

    // TODO: publish to clients

    // Overwrite target specified in item variables
    if (prop.variables.target) {
        target = (await itemVariableValue(item, "target")) as
            | PlayerEntity
            | MonsterEntity
            | ItemEntity;
    }

    // Overwrite self specified in item variables (can only be `player` or `monster`)
    if (prop.variables.self) {
        self = (await itemVariableValue(item, "self")) as
            | PlayerEntity
            | MonsterEntity;
    }

    // Perform ability
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
            // Reset item state
            item.state = propAction.state.start;
            item = (await itemRepository.save(item.item, item)) as ItemEntity;
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
    item.state = propAction.state.end;
    item.charges -= propAction.cost.charges;
    item.durability -= propAction.cost.durability;
    item = (await itemRepository.save(item.item, item)) as ItemEntity;

    // TODO: publish to clients

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
    action: string,
): { canUse: boolean; message: string } {
    // Check valid prop
    if (!compendium.hasOwnProperty(item.prop)) {
        return {
            canUse: false,
            message: `${item.prop} not found in compendium`,
        };
    }
    const prop = compendium[item.prop];

    // Check valid action
    if (!(prop.actions && prop.actions[action])) {
        return {
            canUse: false,
            message: `Invalid action ${action} for item ${item.item}`,
        };
    }

    // Check if have permissions to use item
    if (!hasItemOwnerPermissions(item, self)) {
        return {
            canUse: false,
            message: `${self.player || self.monster} does not own ${item.item}`,
        };
    }

    // Check has enough charges or durability
    const propAction = prop.actions[action];
    if (item.charges < propAction.cost.charges) {
        return {
            canUse: false,
            message: `${item.item} has not enough charges to perform ${action}`,
        };
    }
    if (item.durability < propAction.cost.durability) {
        return {
            canUse: false,
            message: `${item.item} has not enough durability to perform ${action}`,
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
        item.owner === "" ||
        item.owner === self.player ||
        item.owner === self.monster
    );
}

function hasItemConfigOwnerPermissions(
    item: ItemEntity,
    self: PlayerEntity | MonsterEntity,
) {
    return (
        item.configOwner === "" ||
        item.configOwner === self.player ||
        item.configOwner === self.monster
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

function updatedItemVariables(
    item: ItemEntity,
    variables: ItemVariables,
): string {
    return JSON.stringify({
        ...JSON.parse(item.variables),
        ...parseItemVariables(variables, item.prop),
    });
}

async function itemVariableValue(
    item: ItemEntity,
    key: string,
): Promise<
    string | number | boolean | PlayerEntity | MonsterEntity | ItemEntity
> {
    const itemVariables = JSON.parse(item.variables);
    const propVariables = compendium[item.prop].variables;

    const { type } = propVariables[key];
    const variable = itemVariables[key];

    if (type === "item") {
        return (await itemRepository.fetch(variable)) as ItemEntity;
    } else if (type === "player") {
        return (await playerRepository.fetch(variable)) as PlayerEntity;
    } else if (type === "monster") {
        return (await monsterRepository.fetch(variable)) as MonsterEntity;
    } else if (type === "string") {
        return String(variable);
    } else if (type === "number") {
        return Number(variable);
    } else if (type === "boolean") {
        return Boolean(variable);
    }

    throw new Error(`Invalid variable type ${type} for item ${item.item}`);
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
    const { procedures, ap, mp, st, hp, range } = abilities[ability];

    // Check if player is busy
    if (self.player && (await isEntityBusy((self as PlayerEntity).player))) {
        return {
            self,
            target,
            status: "failure",
            message: "Player is busy",
        };
    }

    // Check if self has enough resources to perform ability
    if (!ignoreCost && !canPerformAbility(self, ability)) {
        return {
            self,
            target,
            status: "failure",
            message: "Not enough resources to perform ability",
        };
    }

    // Check if target is in range
    if (!checkInRange(self, target, range)) {
        return {
            self,
            target,
            status: "failure",
            message: "Target out of range",
        };
    }

    // Set player busy state (only for player entities)
    if (self.player) {
        const ticks = procedures.reduce(
            (acc, [type, effect]) => acc + effect.ticks,
            0,
        );
        setEnityBusy((self as PlayerEntity).player, ticks * MS_PER_TICK);
    }

    // Expend ability costs
    if (!ignoreCost) {
        self.ap -= ap;
        self.mp -= mp;
        self.st -= st;
        self.hp -= hp;
    }
    self = (await saveEntity(self)) as PlayerEntity | MonsterEntity;

    // Perform procedures
    for (const [type, effect] of procedures) {
        let entity = effect.target === "self" ? self : target;

        if (type === "action") {
            // Fill in effect variables
            const actualEffect = fillInEffectVariables({
                effect,
                self,
                target,
            });

            // Perform effect action
            entity = await performEffectAction({
                entity,
                effect: actualEffect,
            });
            await saveEntity(entity);

            // Update self or target
            if (effect.target === "self") {
                self = entity as PlayerEntity | MonsterEntity;
            } else {
                target = entity as PlayerEntity | MonsterEntity | ItemEntity;
            }

            // Publish effect to player
            if (entity.player) {
                await publishEffectToPlayer(
                    (entity as PlayerEntity).player,
                    actualEffect,
                );
            }
        } else if (type === "check") {
            if (!performEffectCheck({ entity, effect })) break;
        }
    }

    return { self, target, status: "success", message: "" };
}

async function performEffectAction({
    entity,
    effect,
}: {
    entity: PlayerEntity | MonsterEntity | ItemEntity;
    effect: ProcedureEffect;
}): Promise<PlayerEntity | MonsterEntity | ItemEntity> {
    // Sleep for the duration of the effect
    await sleep(effect.ticks * MS_PER_TICK);

    // Damage
    if (effect.damage) {
        // Player or monster
        if (entity.player || entity.monster) {
            entity.hp = Math.max(
                0,
                (entity as PlayerEntity | MonsterEntity).hp -
                    effect.damage.amount,
            );
        }
        // Item
        else if (entity.item) {
            entity.durability = Math.max(
                0,
                (entity as ItemEntity).durability - effect.damage.amount,
            );
        }
    }

    // Debuff
    if (effect.debuffs) {
        const { debuff, op } = effect.debuffs;
        if (op === "push") {
            if (!entity.debuffs.includes(debuff)) {
                entity.debuffs.push(debuff);
            }
        } else if (op === "pop") {
            entity.debuffs = entity.debuffs.filter((d) => d !== debuff);
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
            return entity.debuffs.includes(debuff);
        } else if (op === "doesNotContain") {
            return !entity.debuffs.includes(debuff);
        }
    }

    if (buffs) {
        const { buff, op } = buffs;
        if (op === "contains") {
            return entity.buffs.includes(buff);
        } else if (op === "doesNotContain") {
            return !entity.buffs.includes(buff);
        }
    }

    return false;
}

async function publishEffectToPlayer(player: string, effect: ProcedureEffect) {
    const { buffs, debuffs, damage } = effect;

    // Create message data
    const messageFeed: MessageFeed = {
        type: "message",
        message: "TODO",
        variables: {},
    };

    await redisClient.publish(player, JSON.stringify(messageFeed));
}
