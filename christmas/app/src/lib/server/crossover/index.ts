import { actions, type Actions } from "$lib/crossover/actions";
import {
    calculateLocation,
    childrenGeohashes,
    entityDimensions,
    entityId,
    geohashNeighbour,
} from "$lib/crossover/utils";
import type { Direction, WorldAssetMetadata } from "$lib/crossover/world";
import {
    checkInRange,
    hasResourcesForAbility,
    patchEffectWithVariables,
    type ProcedureEffect,
} from "$lib/crossover/world/abilities";
import { monsterStats } from "$lib/crossover/world/bestiary";
import { biomeAtGeohash } from "$lib/crossover/world/biomes";
import {
    type EquipmentSlot,
    type ItemVariables,
} from "$lib/crossover/world/compendium";
import { playerStats } from "$lib/crossover/world/player";
import {
    MS_PER_TICK,
    abilities,
    bestiary,
    biomes,
    compendium,
    worldSeed,
} from "$lib/crossover/world/settings";
import { serverAnchorClient } from "$lib/server";
import { parseZodErrors, sleep } from "$lib/utils";
import { PublicKey } from "@solana/web3.js";
import lodash from "lodash";
import { z } from "zod";
import type { UpdateEntitiesEvent } from "../../../routes/api/crossover/stream/+server";
import { ObjectStorage } from "../objectStorage";
import {
    collidersInGeohashQuerySet,
    itemRepository,
    monsterRepository,
    playerRepository,
    redisClient,
    worldRepository,
} from "./redis";
import {
    type ItemEntity,
    type MonsterEntity,
    type Player,
    type PlayerEntity,
    type WorldEntity,
} from "./redis/entities";
import {
    PlayerStateSchema,
    type PlayerMetadataSchema,
    type UserMetadataSchema,
} from "./router";

const { uniqBy } = lodash;

export {
    autoCorrectGeohashPrecision,
    checkAndSetBusy,
    configureItem,
    connectedUsers,
    consumeResources,
    crossoverAuthPlayerMetadata,
    getUserMetadata,
    initPlayerEntity,
    isDirectionTraversable,
    itemVariableValue,
    loadPlayerEntity,
    performAbility,
    recoverAp,
    saveEntity,
    savePlayerEntityState,
    setPlayerState,
    spawnItem,
    spawnMonster,
    spawnWorld,
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
async function crossoverAuthPlayerMetadata(
    publicKey: string,
): Promise<z.infer<typeof PlayerMetadataSchema> | null> {
    return (await getUserMetadata(publicKey))?.crossover || null;
}

/**
 * Retrieves the player state for a given public key.
 * @param publicKey The public key of the player.
 * @returns A promise that resolves to the player state or null if not found.
 */
async function crossoverAuthPlayerState(
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
    const playerMetadata = await crossoverAuthPlayerMetadata(publicKey);
    if (playerMetadata == null) {
        throw new Error(`Player ${publicKey} not found`);
    }

    // Get & update player state
    const newPlayerState = {
        ...((await crossoverAuthPlayerState(publicKey)) || {}),
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
 * @param geohash The geohash of the user (community).
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
    if (!player.location) {
        // TODO: Spawn player in region's city center spawn point
        player.location = [geohash];
        player.locationType = "geohash";
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
    if (player.location[0].length !== worldSeed.spatial.unit.precision) {
        player.location = [
            autoCorrectGeohashPrecision(
                player.location[0],
                worldSeed.spatial.unit.precision,
            ),
        ];
        player.locationType = "geohash";
        console.log("Auto corrected player's location", player.location);
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
 * Auto-corrects the precision of a geohash by either truncating or extending it.
 * @param geohash - The geohash to be corrected.
 * @param precision - The desired precision of the geohash.
 * @returns The corrected geohash with the specified precision.
 */
function autoCorrectGeohashPrecision(
    geohash: string,
    precision: number,
): string {
    if (geohash.length !== precision) {
        const delta = precision - geohash.length;
        if (delta > 0) {
            for (let i = 0; i < delta; i++) {
                geohash = childrenGeohashes(geohash)[0];
            }
        } else if (delta < 0) {
            geohash = geohash.slice(0, precision);
        }
    }
    return geohash;
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

    // Calculate location
    const { width, height, precision } = bestiary[beast].asset;

    // Auto correct geohash precision
    if (geohash.length !== precision) {
        geohash = autoCorrectGeohashPrecision(geohash, precision);
    }

    // Check location for traversability and colliders
    const location = calculateLocation(geohash, width, height);
    for (const loc of location) {
        if (!(await isGeohashTraversable(loc))) {
            throw new Error(`Cannot spawn ${beast}, ${loc} is untraversable`);
        }
    }

    // Get monster stats
    const { hp, mp, st, ap } = monsterStats({ level, beast });
    const monster: MonsterEntity = {
        monster: monsterId, // unique monster id
        name: beast,
        beast,
        location,
        locationType: "geohash",
        level,
        hp,
        mp,
        st,
        ap,
        apclk: Date.now(),
        buclk: 0,
        buffs: [],
        debuffs: [],
    };
    return (await monsterRepository.save(monsterId, monster)) as MonsterEntity;
}

/**
 * Spawns a world asset from a tiled map in a specific geohash.
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
    if (!asset && !assetUrl) {
        throw new Error("asset or assetUrl must be provided");
    }

    asset ??= await (await fetch(assetUrl!)).json();
    const {
        height,
        width,
        layers,
        tileheight: assetTileHeight,
        tilewidth: assetTileWidth,
    } = asset!;

    // Check tilewidth and tileheight must be exact multiples of cellWidth and cellHeight
    if (
        assetTileWidth % tileWidth !== 0 ||
        assetTileHeight % tileHeight !== 0
    ) {
        throw new Error(
            `Tile width and height must be exact multiples of cell width and height`,
        );
    }
    const heightMultiplier = assetTileHeight / tileHeight;
    const widthMultiplier = assetTileWidth / tileWidth;

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
        loc: geohash,
        h: height,
        w: width,
        cdrs: colliders,
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
    for (const loc of location) {
        // Has colliders
        if ((await collidersInGeohashQuerySet(loc).return.count()) > 0) {
            throw new Error(`Cannot spawn item at location ${loc}`);
        }
        // Biome is not traversable
        const biome = biomeAtGeohash(loc);
        if (biomes[biome].traversableSpeed <= 0) {
            throw new Error(`Cannot spawn item at ${biome}`);
        }
    }

    const entity: ItemEntity = {
        item,
        name: defaultName,
        prop,
        location,
        locationType: "geohash",
        owner,
        configOwner,
        collider,
        durability: durability,
        charges: charges,
        state: defaultState,
        variables: parseItemVariables(variables || {}, prop),
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
        return {
            item,
            status: "failure",
            message,
        };
    }

    // Save item with updated variables
    item.variables = {
        ...item.variables,
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
    const playerId = self.player || null; // save the user of the item

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

    // Publish item state to player (non blocking)
    // TODO: what about other people in the vincinity?
    redisClient
        .publish(
            (self as PlayerEntity).player,
            JSON.stringify({
                event: "entities",
                players: [],
                monsters: [],
                items: [item],
            } as UpdateEntitiesEvent),
        )
        .catch((error) => console.error(error));

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
    item.charges -= propUtility.cost.charges;
    item.durability -= propUtility.cost.durability;
    item = (await itemRepository.save(item.item, item)) as ItemEntity;

    // Publish item state to user (use saved playerId as it might have changed after substitution) (non blocking)
    // TODO: what about other people in the vincinity?
    if (playerId != null) {
        redisClient
            .publish(
                playerId as string,
                JSON.stringify({
                    event: "entities",
                    players: [],
                    monsters: [],
                    items: [item],
                } as UpdateEntitiesEvent),
            )
            .catch((error) => console.error(error));
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
            item.locationType as EquipmentSlot,
        )
    ) {
        return {
            canUse: false,
            message: `${item.item} is not equipped in the required slot`,
        };
    }

    // Check has enough charges or durability
    const propUtility = prop.utilities[utility];
    if (item.charges < propUtility.cost.charges) {
        return {
            canUse: false,
            message: `${item.item} has not enough charges to perform ${utility}`,
        };
    }
    if (item.durability < propUtility.cost.durability) {
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

async function itemVariableValue(
    item: ItemEntity,
    key: string,
): Promise<
    string | number | boolean | PlayerEntity | MonsterEntity | ItemEntity
> {
    const itemVariables = item.variables;
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
    if (!predicate.targetSelfAllowed) {
        if (entityId(self) === entityId(target)) {
            return {
                self,
                target,
                status: "failure",
                message: `You can't ${ability} yourself`,
            };
        }
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

    // Expend ability costs
    if (!ignoreCost) {
        self = await consumeResources(self, { ap, mp, st, hp });
    }
    target = target.player === self.player ? self : target; // target might be self, in which case update it after save

    // Publish ability costs changes to player (non blocking)
    if (self.player && !ignoreCost) {
        redisClient
            .publish(
                (self as PlayerEntity).player,
                JSON.stringify({
                    event: "entities",
                    players: [self],
                    monsters: [],
                    items: [],
                } as UpdateEntitiesEvent),
            )
            .catch((error) => console.error(error));
    }

    // Perform procedures
    for (const [type, effect] of procedures) {
        // Get effected entity (self or target)
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
            entity = await performEffectOnEntity({
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

            // Publish effect & effected entities to relevant players (non blocking)
            if (self.player || entity.player) {
                publishEffectToPlayers({
                    self,
                    entities: [self, target],
                    effect: actualEffect,
                }).catch((error) => console.error(error));
            }
        }
        // Check
        else if (type === "check") {
            if (!performEffectCheck({ entity, effect })) break;
        }
    }

    return { self, target, status: "success", message: "" };
}

async function performEffectOnEntity({
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

            // Patch location (if the location dimensions have changed beyond the asset's dimensions)
            if (state === "location") {
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

async function publishEffectToPlayers({
    self,
    entities,
    effect,
}: {
    self: PlayerEntity | MonsterEntity;
    entities: (PlayerEntity | MonsterEntity | ItemEntity)[];
    effect: ProcedureEffect;
}) {
    const effectedPlayers = uniqBy(
        [self, ...entities].filter((entity) => entity.player),
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

    for (const geohash of entity.location) {
        const nextGeohash = geohashNeighbour(geohash, direction);

        // Inside current location is always traversable
        if (entity.location.includes(nextGeohash)) {
            location.push(nextGeohash);
            continue;
        }

        // Check if geohash is traversable
        if (!(await isGeohashTraversable(nextGeohash))) {
            return [false, entity.location]; // early return if not traversable
        } else {
            location.push(nextGeohash);
        }
    }
    return [true, location];
}

async function isGeohashTraversable(geohash: string): Promise<boolean> {
    // Check if biome is traversable
    if (biomes[biomeAtGeohash(geohash)].traversableSpeed <= 0) {
        return false;
    }

    // Get colliders in geohash
    if ((await collidersInGeohashQuerySet(geohash).return.count()) > 0) {
        return false;
    }

    return true;
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
    const now = Date.now();
    if (entity.buclk > now) {
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
        ? playerStats({ level: entity.level }).ap
        : monsterStats({
              level: entity.level,
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
    // Get max stats
    const {
        ap: maxAp,
        hp: maxHp,
        st: maxSt,
        mp: maxMp,
    } = entity.player
        ? playerStats({ level: entity.level })
        : monsterStats({
              level: entity.level,
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
