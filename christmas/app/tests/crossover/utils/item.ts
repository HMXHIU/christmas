import {
    crossoverCmdConfigureItem,
    crossoverCmdCreateItem,
    crossoverCmdDrop,
    crossoverCmdEquip,
    crossoverCmdTake,
    crossoverCmdUnequip,
    crossoverCmdUseItem,
} from "$lib/crossover/client";
import type {
    Item,
    ItemEntity,
    MonsterEntity,
    Player,
    PlayerEntity,
} from "$lib/crossover/types";
import { type ItemVariables } from "$lib/crossover/world/compendium";
import { abilities } from "$lib/crossover/world/settings/abilities";
import { compendium } from "$lib/crossover/world/settings/compendium";
import type { EquipmentSlot } from "$lib/crossover/world/types";
import { canUseItem, itemVariableValue } from "$lib/server/crossover/utils";
import { sleep } from "$lib/utils";
import { cloneDeep } from "lodash-es";
import { expect } from "vitest";
import {
    collectEventDataForDuration,
    waitForEventData,
    type PerformAbilityTestResults,
} from ".";
import type { UpdateEntitiesEvent } from "../../../src/routes/api/crossover/stream/+server";

export async function testPlayerUseItem({
    self,
    item,
    utility,
    cookies,
    stream,
}: {
    self: Player;
    item: Item;
    utility: string;
    cookies: string;
    stream: EventTarget;
}): Promise<
    [
        PerformAbilityTestResults,
        {
            self: Player;
            item: Item;
            selfBefore: Player;
            itemBefore: Item;
        },
    ]
> {
    const selfBefore = cloneDeep(self);
    const itemBefore = cloneDeep(item);
    const prop = compendium[item.prop];
    const propUtility = prop.utilities![utility];

    // Self use item on target
    await crossoverCmdUseItem(
        {
            item: item.item,
            utility,
        },
        { Cookie: cookies },
    );

    // Check if can use item
    const { canUse, message } = canUseItem(
        self as PlayerEntity,
        item as ItemEntity,
        utility,
    );

    // Check received feed event if can't use item
    if (!canUse) {
        console.log("Checking feed event for can't use item");
        await expect(waitForEventData(stream, "feed")).resolves.toMatchObject({
            type: "error",
            message,
        });
        return ["itemConditionsNotMet", { self, item, selfBefore, itemBefore }];
    }

    let entitiesEvents: UpdateEntitiesEvent[] = [];
    let entitiesEventsCnt = 0;
    collectEventDataForDuration(stream, "entities").then((events) => {
        entitiesEvents = events as UpdateEntitiesEvent[];
    });
    await sleep(500); // wait for events to be collected

    // Check received item start state event
    if (item.state !== propUtility.state.start) {
        console.log("Checking event for item start state");
        await expect(entitiesEvents[entitiesEventsCnt++]).toMatchObject({
            players: [{ player: self.player }],
            monsters: [],
            items: [
                {
                    item: item.item,
                    state: propUtility.state.start,
                },
            ],
        });
    }

    // Check ability event
    const propAbility = propUtility.ability;

    // Check perform ability
    if (propAbility) {
        let targetEntity;
        let newSelf: PlayerEntity | MonsterEntity = self as PlayerEntity;

        // Overwrite target if specified in item variables
        if (prop.variables.target) {
            targetEntity = (await itemVariableValue(
                item as ItemEntity,
                "target",
            )) as PlayerEntity | MonsterEntity | ItemEntity;
        }

        // Overwrite self if specified in item variables (can only be `player` or `monster`)
        if (prop.variables.self) {
            newSelf = (await itemVariableValue(item as ItemEntity, "self")) as
                | PlayerEntity
                | MonsterEntity;
        }

        // Consume ability effects (hard to check and listen for events)
        if (targetEntity && self.player === newSelf.player) {
            for (const [type, effect] of abilities[propAbility].procedures) {
                if (type === "action") {
                    // Update self
                    if (entitiesEvents[entitiesEventsCnt].players) {
                        self = {
                            ...self,
                            ...(entitiesEvents[entitiesEventsCnt].players?.find(
                                (p) => p.player === self.player,
                            ) || {}),
                        };
                    }
                    entitiesEventsCnt += 1;
                }
            }
        }
    }

    // Check received item end state event
    console.log("Checking event for item end state");
    await expect(entitiesEvents[entitiesEventsCnt]).toMatchObject({
        items: [
            {
                item: item.item,
                state: propUtility.state.end,
                chg: itemBefore.chg - propUtility.cost.charges,
                dur: itemBefore.dur - propUtility.cost.durability,
            },
        ],
    });

    // Update item
    item = {
        ...item,
        ...(entitiesEvents[entitiesEventsCnt]?.items?.find(
            (i) => i.item === item.item,
        ) || {}),
    };

    return ["success", { self, selfBefore, item, itemBefore }];
}

export async function testPlayerCreateItem({
    self,
    geohash,
    prop,
    cookies,
    stream,
    variables,
}: {
    self: Player;
    geohash: string;
    prop: string;
    variables?: ItemVariables;
    cookies: string;
    stream: EventTarget;
}): Promise<
    [
        PerformAbilityTestResults,
        {
            self: Player;
            item?: Item;
            selfBefore: Player;
        },
    ]
> {
    const selfBefore = cloneDeep(self);

    // Create item
    await crossoverCmdCreateItem(
        {
            geohash,
            prop: prop,
            variables,
            locationType: "geohash",
        },
        { Cookie: cookies },
    );

    const { items } = (await waitForEventData(
        stream,
        "entities",
    )) as UpdateEntitiesEvent;

    if (items == null || items.length !== 1) {
        return ["failure", { self, selfBefore }];
    }

    expect(items[0]).toMatchObject({
        name: compendium[prop].defaultName,
        state: compendium[prop].defaultState,
        loc: [geohash],
        ...(variables && { vars: variables }),
    });
    return ["success", { self, item: items[0], selfBefore }];
}

export async function testPlayerTakeItem({
    self,
    item,
    cookies,
    stream,
}: {
    self: Player;
    item: Item;
    cookies: string;
    stream: EventTarget;
}): Promise<
    [
        PerformAbilityTestResults,
        {
            self: Player;
            item?: Item;
            itemBefore: Item;
            selfBefore: Player;
        },
    ]
> {
    const selfBefore = cloneDeep(self);
    const itemBefore = cloneDeep(item);

    // Take item
    await crossoverCmdTake({ item: item.item }, { Cookie: cookies });

    const { items } = (await waitForEventData(
        stream,
        "entities",
    )) as UpdateEntitiesEvent;

    if (items == null || items.length !== 1) {
        return ["failure", { self, selfBefore, itemBefore }];
    }

    item = items[0];
    const prop = compendium[item.prop];

    expect(item).toMatchObject({
        name: prop.defaultName,
        state: prop.defaultState,
        locT: "inv",
        loc: [self.player],
    });
    return ["success", { self, item, selfBefore, itemBefore }];
}

export async function testPlayerEquipItem({
    self,
    item,
    slot,
    cookies,
    stream,
}: {
    self: Player;
    item: Item;
    slot: EquipmentSlot;
    cookies: string;
    stream: EventTarget;
}): Promise<
    [
        PerformAbilityTestResults,
        {
            self: Player;
            item?: Item;
            itemBefore: Item;
            selfBefore: Player;
        },
    ]
> {
    const selfBefore = cloneDeep(self);
    const itemBefore = cloneDeep(item);

    // Equip item
    await crossoverCmdEquip({ item: item.item, slot }, { Cookie: cookies });

    const { items } = (await waitForEventData(
        stream,
        "entities",
    )) as UpdateEntitiesEvent;

    item = items?.find((i) => item.item === i.item) as Item; // may also receive unequipped items in existing slot

    if (item == null) {
        return ["failure", { self, selfBefore, itemBefore }];
    }

    const prop = compendium[item.prop];
    expect(item).toMatchObject({
        name: prop.defaultName,
        state: prop.defaultState,
        locT: slot,
        loc: [self.player],
    });
    return ["success", { self, item, selfBefore, itemBefore }];
}

export async function testPlayerUnequipItem({
    self,
    item,
    cookies,
    stream,
}: {
    self: Player;
    item: Item;
    cookies: string;
    stream: EventTarget;
}): Promise<
    [
        PerformAbilityTestResults,
        {
            self: Player;
            item?: Item;
            itemBefore: Item;
            selfBefore: Player;
        },
    ]
> {
    const selfBefore = cloneDeep(self);
    const itemBefore = cloneDeep(item);

    // Equip item
    await crossoverCmdUnequip({ item: item.item }, { Cookie: cookies });

    const { items } = (await waitForEventData(
        stream,
        "entities",
    )) as UpdateEntitiesEvent;

    // May also receive unequipped items in existing slot
    item = items?.find((i) => item.item === i.item) as Item;
    if (item == null) {
        return ["failure", { self, selfBefore, itemBefore }];
    }

    const prop = compendium[item.prop];
    expect(item).toMatchObject({
        name: prop.defaultName,
        state: prop.defaultState,
        locT: "inv",
        loc: [self.player],
    });
    return ["success", { self, item, selfBefore, itemBefore }];
}

export async function testPlayerDropItem({
    self,
    item,
    cookies,
    stream,
}: {
    self: Player;
    item: Item;
    cookies: string;
    stream: EventTarget;
}): Promise<
    [
        PerformAbilityTestResults,
        {
            self: Player;
            item?: Item;
            itemBefore: Item;
            selfBefore: Player;
        },
    ]
> {
    const selfBefore = cloneDeep(self);
    const itemBefore = cloneDeep(item);

    // Equip item
    await crossoverCmdDrop({ item: item.item }, { Cookie: cookies });

    const { items } = (await waitForEventData(
        stream,
        "entities",
    )) as UpdateEntitiesEvent;

    // May also receive unequipped items in existing slot
    item = items?.find((i) => item.item === i.item) as Item;
    if (item == null) {
        return ["failure", { self, selfBefore, itemBefore }];
    }

    const prop = compendium[item.prop];
    expect(item).toMatchObject({
        name: prop.defaultName,
        state: prop.defaultState,
        locT: "geohash",
        loc: self.loc,
    });
    return ["success", { self, item, selfBefore, itemBefore }];
}

export async function testPlayerConfigureItem({
    self,
    item,
    cookies,
    stream,
    variables,
}: {
    self: Player;
    item: Item;
    variables: ItemVariables;
    cookies: string;
    stream: EventTarget;
}): Promise<
    [
        PerformAbilityTestResults,
        {
            self: Player;
            selfBefore: Player;
            item: Item;
            itemBefore: Item;
        },
    ]
> {
    const selfBefore = cloneDeep(self);
    const itemBefore = cloneDeep(item);

    // Configure item
    await crossoverCmdConfigureItem(
        {
            item: item.item,
            variables,
        },
        { Cookie: cookies },
    );

    const { items } = (await waitForEventData(
        stream,
        "entities",
    )) as UpdateEntitiesEvent;

    if (items == null || items.length !== 1) {
        return ["failure", { self, selfBefore, item, itemBefore }];
    }

    expect(items[0]).toMatchObject({
        vars: variables,
    });

    return ["success", { self, selfBefore, item: items[0], itemBefore }];
}
