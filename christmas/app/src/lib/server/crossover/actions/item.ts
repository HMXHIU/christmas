import { entityInRange, minifiedEntity } from "$lib/crossover/utils";
import { isItemEquipped } from "$lib/crossover/world/compendium";
import { actions } from "$lib/crossover/world/settings/actions";
import { compendium } from "$lib/crossover/world/settings/compendium";
import {
    equipmentSlotCapacity,
    geohashLocationTypes,
    type EquipmentSlot,
    type GeohashLocation,
} from "$lib/crossover/world/types";
import {
    type ActorEntity,
    type CreatureEntity,
    type ItemEntity,
    type MonsterEntity,
    type PlayerEntity,
} from "$lib/server/crossover/types";
import { setEntityBusy } from "..";
import { useAbility } from "../abilities";
import { resolveEquipment } from "../combat/equipment";
import { spawnItemInInventory } from "../dm";
import { publishAffectedEntitiesToPlayers, publishFeedEvent } from "../events";
import { getNearbyPlayerIds, inventoryQuerySet } from "../redis/queries";
import { fetchEntity, saveEntity } from "../redis/utils";
import {
    hasItemConfigOwnerPermissions,
    hasItemOwnerPermissions,
    itemVariableValue,
    parseItemVariables,
} from "../utils";

export {
    configureItem,
    createItem,
    dropItem,
    equipItem,
    takeItem,
    unequipItem,
    useItem,
};

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
    now,
}: {
    item: ItemEntity;
    utility: string;
    self: CreatureEntity;
    target?: ActorEntity; // target can be an `item`
    now?: number;
}) {
    now = now ?? Date.now();

    // Check if can use item
    const [ok, error] = canUseItem(self, item, utility);
    if (!ok) {
        if (self.player) {
            await publishFeedEvent((self as PlayerEntity).player, {
                type: "error",
                message: error,
            });
        }
        return; // do not proceed
    }

    const prop = compendium[item.prop];
    const propUtility = prop.utilities[utility];
    const propAbility = propUtility.ability;
    const nearbyPlayerIds = await getNearbyPlayerIds(
        self.loc[0],
        self.locT as GeohashLocation,
        self.locI,
    );

    if (item.state !== propUtility.state.start) {
        // Set item start state
        item.state = propUtility.state.start;
        await saveEntity(item);

        // Publish item state to nearby players
        if (self.player != null) {
            await publishAffectedEntitiesToPlayers([minifiedEntity(item)], {
                publishTo: nearbyPlayerIds,
            });
        }
    }
    // Perform ability (ignore cost when using items)
    if (propAbility) {
        // Overwrite target if specified in item variables
        if (prop.variables.target) {
            target = (await itemVariableValue(item, "target")) as ActorEntity;
        }

        // Overwrite self if specified in item variables (can only be `player` or `monster`)
        if (prop.variables.self) {
            self = (await itemVariableValue(item, "self")) as
                | PlayerEntity
                | MonsterEntity;
        }
        //  Use ability
        await useAbility({
            self,
            target, // can be undefined for abilities on self (eg. heal)
            ability: propAbility,
            ignoreCost: true, // ignore cost when using items
            now,
        });
    }

    // Set item end state, consume charges and durability
    item.state = propUtility.state.end;
    item.chg -= propUtility.cost.charges;
    item.dur -= propUtility.cost.durability;
    await saveEntity(item);

    // Publish item state to nearby players
    await publishAffectedEntitiesToPlayers(
        [minifiedEntity(item, { stats: true })],
        {
            publishTo: nearbyPlayerIds,
        },
    );
}

function canEquipItem(
    player: PlayerEntity,
    item: ItemEntity,
): [boolean, string] {
    if (!item) {
        return [false, `Item not found`];
    } else if (!compendium[item.prop].equipment) {
        return [false, `${item.item} is not equippable`];
    } else if (item.loc[0] !== player.player) {
        return [false, `${item.item} is not in inventory`];
    }
    return [true, ""];
}

async function equipItem(player: PlayerEntity, item: string, now?: number) {
    // Set busy
    player = (await setEntityBusy({
        entity: player,
        action: actions.equip.action,
        now: now,
    })) as PlayerEntity;

    // Check can equip
    let itemToEquip = (await fetchEntity(item)) as ItemEntity;
    const [ok, error] = canEquipItem(player, itemToEquip);
    if (!ok) {
        await publishFeedEvent(player.player, {
            type: "error",
            message: error,
        });
        return; // do not proceed
    }
    const equipment = compendium[itemToEquip.prop].equipment!;
    const slotSize = equipment.slotSize ?? 1;
    const slotCapacity = equipmentSlotCapacity[equipment.slot] ?? 1;

    // Unequip existing items in slot to free up capacity
    const exitingItemsInSlot = (await inventoryQuerySet(player.player)
        .and("locT")
        .equal(equipment.slot)
        .return.all()) as ItemEntity[];
    const occupiedSlots = exitingItemsInSlot.reduce(
        (acc, i) => acc + (compendium[i.prop].equipment?.slotSize ?? 1),
        0,
    );
    const emptySlots = slotCapacity - occupiedSlots;
    let slotsToFree = slotSize - emptySlots;
    if (slotsToFree > 0) {
        for (const eq of exitingItemsInSlot) {
            eq.loc = [player.player];
            eq.locT = "inv";
            await saveEntity(eq); // save item (location changed)
            slotsToFree -= compendium[eq.prop].equipment?.slotSize ?? 1;
            if (slotsToFree <= 0) {
                break;
            }
        }
    }

    // Equip item in slot
    itemToEquip.loc = [player.player];
    itemToEquip.locT = equipment.slot;
    itemToEquip = await saveEntity(itemToEquip);

    // Resolve equipment
    player = await resolveEquipment(player);
    player = await saveEntity(player);

    // Inform all players nearby of equipment change
    await publishAffectedEntitiesToPlayers(
        [
            itemToEquip,
            ...exitingItemsInSlot,
            minifiedEntity(player, { stats: true }),
        ].map((e) => minifiedEntity(e)),
        {
            publishTo: await getNearbyPlayerIds(
                player.loc[0],
                player.locT as GeohashLocation,
                player.locI,
            ),
        },
    );
}

async function unequipItem(player: PlayerEntity, item: string, now?: number) {
    let itemEntity = (await fetchEntity(item)) as ItemEntity;

    if (itemEntity == null) {
        await publishFeedEvent(player.player, {
            type: "error",
            message: `Item ${item} not found`,
        });
        return;
    }

    // Set busy
    player = (await setEntityBusy({
        entity: player,
        action: actions.unequip.action,
        now,
    })) as PlayerEntity;

    // Check item is on player
    if (itemEntity.loc[0] !== player.player) {
        await publishFeedEvent(player.player, {
            type: "error",
            message: `${item} is not equipped`,
        });
        return;
    }

    // Unequip item
    itemEntity.loc = [player.player];
    itemEntity.locT = "inv";
    itemEntity = await saveEntity(itemEntity);

    // Resolve equipment
    player = await resolveEquipment(player);
    player = await saveEntity(player);

    // Inform all players nearby of equipment change
    const nearbyPlayerIds = await getNearbyPlayerIds(
        player.loc[0],
        player.locT as GeohashLocation,
        player.locI,
    );
    await publishAffectedEntitiesToPlayers(
        [minifiedEntity(itemEntity), minifiedEntity(player, { stats: true })],
        {
            publishTo: nearbyPlayerIds,
        },
    );
}

async function takeItem(player: PlayerEntity, item: string, now?: number) {
    // Set busy
    player = (await setEntityBusy({
        entity: player,
        action: actions.take.action,
        now: now,
    })) as PlayerEntity;

    let error: string | null = null;

    // Get item
    let itemEntity = (await fetchEntity(item)) as ItemEntity;
    if (itemEntity == null) {
        error = `Item ${item} not found`;
    }
    // Check item owner is player or public
    else if (itemEntity.own !== player.player && itemEntity.own) {
        error = `${item} is owned by someone else`;
    }
    // Check if in range
    else if (!entityInRange(player, itemEntity, actions.take.range)[0]) {
        error = `${item} is not in range`;
    }
    // Check if item is takeable
    else if (compendium[itemEntity.prop].weight < 0) {
        error = `${item} cannot be taken`;
    }

    if (error) {
        await publishFeedEvent(player.player, {
            type: "error",
            message: error,
        });
        return; // do not proceed
    }

    // Take item
    itemEntity.loc = [player.player];
    itemEntity.locT = "inv";
    itemEntity = await saveEntity(itemEntity);

    // Inform all players nearby of item creation
    const nearbyPlayerIds = await getNearbyPlayerIds(
        player.loc[0],
        player.locT as GeohashLocation,
        player.locI,
    );
    await publishAffectedEntitiesToPlayers(
        [minifiedEntity(itemEntity, { stats: true })],
        { publishTo: nearbyPlayerIds },
    );
}

async function dropItem(player: PlayerEntity, item: string, now?: number) {
    // Set busy
    player = (await setEntityBusy({
        entity: player,
        action: actions.drop.action,
        now: now,
    })) as PlayerEntity;

    // Get item
    let itemEntity = (await fetchEntity(item)) as ItemEntity;
    if (itemEntity == null) {
        await publishFeedEvent(player.player, {
            type: "error",
            message: `Item ${item} not found`,
        });
        return;
    }

    // Check item is on player
    if (itemEntity.loc[0] !== player.player) {
        await publishFeedEvent(player.player, {
            type: "error",
            message: `${item} is not in inventory`,
        });
        return;
    }

    // Check can't drop equipped item
    if (isItemEquipped(itemEntity, player)) {
        await publishFeedEvent(player.player, {
            type: "error",
            message: `Can't drop equipped ${item}, unequip it first`,
        });
        return;
    }

    if (!geohashLocationTypes.has(player.locT)) {
        await publishFeedEvent(player.player, {
            type: "error",
            message: `You cannot drop ${item} here`,
        });
        return;
    }

    // Drop item
    itemEntity.loc = player.loc;
    itemEntity.locT = player.locT;
    itemEntity.locI = player.locI;
    itemEntity = await saveEntity(itemEntity);

    // Inform all players nearby of item creation
    const nearbyPlayerIds = await getNearbyPlayerIds(
        player.loc[0],
        player.locT as GeohashLocation,
        player.locI,
    );
    await publishAffectedEntitiesToPlayers(
        [minifiedEntity(itemEntity, { stats: true })],
        { publishTo: nearbyPlayerIds },
    );
}

async function createItem(
    player: PlayerEntity,
    prop: string,
    variables?: Record<string, string | number | boolean>,
    now?: number,
) {
    // Set busy
    player = await setEntityBusy({
        entity: player,
        action: actions.create.action,
        now: now,
    });

    try {
        // Create item in player inventory
        const item = await spawnItemInInventory({
            entity: player,
            prop,
            variables,
            owner: player.player, // owner is player
            configOwner: player.player,
        });
        await publishAffectedEntitiesToPlayers(
            [minifiedEntity(item, { stats: true })],
            { publishTo: [player.player] },
        );
    } catch (error: any) {
        await publishFeedEvent(player.player, {
            type: "error",
            message: error.message,
        });
    }
}

async function configureItem(
    player: PlayerEntity,
    item: string,
    variables: Record<string, string | number | boolean>,
    now?: number,
) {
    // Set busy
    player = (await setEntityBusy({
        entity: player,
        action: actions.configure.action,
        now: now,
    })) as PlayerEntity;

    // Get item
    let itemEntity = (await fetchEntity(item)) as ItemEntity;
    if (itemEntity == null) {
        await publishFeedEvent(player.player, {
            type: "error",
            message: `Item ${item} not found`,
        });
        return; // do not proceed
    }

    // Check in range
    if (!entityInRange(player, itemEntity, actions.configure.range)[0]) {
        await publishFeedEvent(player.player, {
            type: "error",
            message: `${item} is not in range`,
        });
        return; // do not proceed
    }

    // Check if can configure item
    const [ok, error] = canConfigureItem(player, itemEntity);
    if (!ok) {
        await publishFeedEvent(player.player, {
            type: "error",
            message: error,
        });
        return; // do not proceed
    }

    // Save item with updated variables
    itemEntity.vars = {
        ...itemEntity.vars,
        ...parseItemVariables(variables, itemEntity.prop),
    };
    itemEntity = await saveEntity(itemEntity);

    // Publish update event
    await publishAffectedEntitiesToPlayers([minifiedEntity(itemEntity)], {
        publishTo: [player.player],
    });
}

function canUseItem(
    self: CreatureEntity,
    item: ItemEntity,
    utility: string,
): [boolean, string] {
    // Check valid prop
    if (!compendium.hasOwnProperty(item.prop)) {
        return [false, `${item.prop} not found in compendium`];
    }
    const prop = compendium[item.prop];

    // Check valid utility
    if (!(prop.utilities && prop.utilities[utility])) {
        return [false, `Invalid utility ${utility} for item ${item.item}`];
    }
    const propUtility = prop.utilities[utility];

    // Check item in range
    if (propUtility.range != null) {
        if (!entityInRange(self, item, propUtility.range)[0]) {
            return [false, `${item.name} is out of range`];
        }
    }

    // Check if have permissions to use item
    if (!hasItemOwnerPermissions(item, self)) {
        return [
            false,
            `${self.player || self.monster} does not own ${item.item}`,
        ];
    }

    // Check if utility requires item to be equipped and is equipped in the correct slot
    if (
        prop.utilities[utility].requireEquipped &&
        !compendium[item.prop].equipment?.slot?.includes(
            item.locT as EquipmentSlot,
        )
    ) {
        return [false, `${item.item} is not equipped in the required slot`];
    }

    // Check has enough charges or durability
    if (item.chg < propUtility.cost.charges) {
        return [
            false,
            `${item.item} has not enough charges to perform ${utility}`,
        ];
    }
    if (item.dur < propUtility.cost.durability) {
        return [
            false,
            `${item.item} has not enough durability to perform ${utility}`,
        ];
    }

    return [true, ""];
}

function canConfigureItem(
    self: CreatureEntity,
    item: ItemEntity,
): [boolean, string] {
    // Check valid prop
    if (!compendium.hasOwnProperty(item.prop)) {
        return [false, `${item.prop} not found in compendium`];
    }

    // Check if have permissions to configure item
    if (!hasItemConfigOwnerPermissions(item, self)) {
        return [
            false,
            `${self.player || self.monster} does not own ${item.item}`,
        ];
    }

    return [true, ""];
}
