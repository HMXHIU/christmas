import type {
    EntityType,
    Item,
    Monster,
    Player,
} from "$lib/server/crossover/redis/entities";
import type { GameActionEntities, TokenPositions } from "../ir";
import { getEntityId } from "../utils";
import { compendium } from "./settings/compendium";
import {
    EquipmentSlots,
    geohashLocationTypes,
    type EquipmentSlot,
} from "./types";

export {
    actions,
    playerActions,
    resolveActionEntities,
    type Action,
    type Actions,
    type IconAssetMetadata,
};

type Actions =
    | "look"
    | "say"
    | "move"
    | "equip"
    | "unequip"
    | "take"
    | "drop"
    | "create"
    | "configure"
    | "inventory"
    | "enter" // targets a item's world property
    | "rest";

type ActionTargets = EntityType | "none";

interface Action {
    action: Actions;
    description: string;
    predicate: {
        target: ActionTargets[];
        tokenPositions: Record<string, number>;
    };
    range: number;
    ticks: number;
    icon: IconAssetMetadata;
}

interface IconAssetMetadata {
    path: string; // eg. bundle/alias
    icon: string;
}

const actions: Record<Actions, Action> = {
    look: {
        action: "look",
        description: "Look at the surroundings.",
        predicate: {
            target: ["player", "monster", "item", "none"],
            tokenPositions: { action: 0, target: 1 },
        },
        icon: {
            path: "actions/actions",
            icon: "look-at",
        },
        ticks: 0,
        range: 0,
    },
    say: {
        action: "say",
        description: "Say something.",
        predicate: {
            target: ["player", "monster", "none"],
            tokenPositions: { action: 0, target: 1 },
        },
        ticks: 1,
        icon: {
            path: "actions/actions",
            icon: "talk",
        },
        range: 0,
    },
    move: {
        action: "move",
        description: "Move in a direction.",
        predicate: {
            target: ["none"],
            tokenPositions: { action: 0 },
        },
        ticks: 1,
        icon: {
            path: "actions/actions",
            icon: "walk",
        },
        range: 0,
    },
    take: {
        action: "take",
        description: "Take an item.",
        predicate: {
            target: ["item"],
            tokenPositions: { action: 0, target: 1 },
        },
        ticks: 1,
        icon: {
            path: "actions/actions",
            icon: "drop-weapon",
        },
        range: 1,
    },
    drop: {
        action: "drop",
        description: "Drop an item.",
        predicate: {
            target: ["item"],
            tokenPositions: { action: 0, target: 1 },
        },
        ticks: 1,
        icon: {
            path: "actions/actions",
            icon: "drop-weapon",
        },
        range: 0,
    },
    equip: {
        action: "equip",
        description: "Equip an item.",
        predicate: {
            target: ["item"],
            tokenPositions: { action: 0, target: 1 },
        },
        ticks: 1,
        icon: {
            path: "actions/actions",
            icon: "switch-weapon",
        },
        range: 0,
    },
    unequip: {
        action: "unequip",
        description: "Unequip an item.",
        predicate: {
            target: ["item"],
            tokenPositions: { action: 0, target: 1 },
        },
        ticks: 1,
        icon: {
            path: "actions/actions",
            icon: "switch-weapon",
        },
        range: 0,
    },
    create: {
        action: "create",
        description: "Create an item.",
        predicate: {
            target: ["none"],
            tokenPositions: { action: 0 },
        },
        ticks: 1,
        icon: {
            path: "actions/actions",
            icon: "stone-crafting",
        },
        range: 0,
    },
    configure: {
        action: "configure",
        description: "Configure an item.",
        predicate: {
            target: ["item"],
            tokenPositions: { action: 0, target: 1 },
        },
        ticks: 1,
        icon: {
            path: "actions/actions",
            icon: "stone-crafting",
        },
        range: 1,
    },
    inventory: {
        action: "inventory",
        description: "View inventory.",
        predicate: {
            target: ["none"],
            tokenPositions: { action: 0 },
        },
        ticks: 0,
        icon: {
            path: "actions/actions",
            icon: "stick-splitting",
        },
        range: 0,
    },
    rest: {
        action: "rest",
        description: "Rest and recover.",
        predicate: {
            target: ["none"],
            tokenPositions: { action: 0 },
        },
        ticks: 4,
        icon: {
            path: "actions/actions",
            icon: "night-sleep",
        },
        range: 0,
    },
    // Spawn and enter an item's world property (only applicable if item as `world`)
    enter: {
        action: "enter",
        description: "Enter.",
        predicate: {
            target: ["item"],
            tokenPositions: { action: 0, target: 1 },
        },
        ticks: 1,
        icon: {
            path: "actions/actions",
            icon: "walk",
        },
        range: 1,
    },
};
function resolveActionEntities({
    queryTokens,
    tokenPositions,
    action,
    self,
    monsters,
    players,
    items,
}: {
    queryTokens: string[];
    tokenPositions: TokenPositions;
    action: Action;
    self: Player | Monster;
    monsters: Monster[];
    players: Player[];
    items: Item[];
}): GameActionEntities[] {
    const { target: targetTypes, tokenPositions: predicateTokenPositions } =
        actions[action.action].predicate;
    const { action: actionTokenPosition, target: targetTokenPosition } =
        predicateTokenPositions;

    // Check action token position
    if (
        actionTokenPosition != null &&
        !(
            action.action in tokenPositions &&
            actionTokenPosition in tokenPositions[action.action]
        )
    ) {
        return [];
    }

    let gameActionEntitiesScores: [GameActionEntities, number][] = [];

    // Find target type in monsters, players, and items
    for (const targetType of targetTypes) {
        let targetList: (Player | Monster | Item)[] = [];

        // Filter target list based on target type
        if (targetType === "monster") {
            targetList = monsters;
        } else if (targetType === "player") {
            targetList = players;
        } else if (targetType === "item") {
            targetList = items;
            // Can only equip an item in inventory
            if (action.action === actions.equip.action) {
                targetList = targetList.filter(
                    (item) =>
                        item.locT === "inv" &&
                        item.loc[0] === getEntityId(self)[0],
                );
            }
            // Can only unequip an item already equipped
            else if (action.action === actions.unequip.action) {
                targetList = targetList.filter(
                    (item) =>
                        EquipmentSlots.includes(item.locT as EquipmentSlot) &&
                        item.loc[0] === getEntityId(self)[0],
                );
            }
            // Can only take an item from environment
            else if (action.action === actions.take.action) {
                targetList = targetList.filter((item) =>
                    geohashLocationTypes.has(item.locT),
                );
            }
            // Can only drop an item from inventory/equipped
            else if (action.action === actions.drop.action) {
                targetList = targetList.filter(
                    (item) =>
                        item.locT === "inv" ||
                        EquipmentSlots.includes(item.locT as EquipmentSlot),
                );
            }
            // Can only enter an item with a world
            else if (action.action === actions.enter.action) {
                targetList = (targetList as Item[]).filter(
                    (item) => compendium[item.prop].world != null,
                );
            }
        } else {
            continue;
        }

        // Find target entities
        for (const target of targetList) {
            const [entityId, entityType] = getEntityId(target);
            // Check target token position
            if (
                targetTokenPosition != null &&
                !(targetTokenPosition in tokenPositions[entityId])
            ) {
                continue;
            }
            gameActionEntitiesScores.push([
                {
                    self,
                    target,
                },
                tokenPositions[entityId][targetTokenPosition].score,
            ]);
        }
    }

    // If no target is allowed
    if (gameActionEntitiesScores.length === 0 && targetTypes.includes("none")) {
        return [{ self }];
    }

    // Sort by score
    return gameActionEntitiesScores
        .sort((a, b) => b[1] - a[1])
        .map((a) => a[0]);
}

const playerActions = [
    actions.say,
    actions.look,
    actions.move,
    actions.take,
    actions.drop,
    actions.equip,
    actions.unequip,
    actions.create,
    actions.configure,
    actions.inventory,
    actions.rest,
    actions.enter,
];
