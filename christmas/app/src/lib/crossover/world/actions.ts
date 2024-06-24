import type {
    EntityType,
    Item,
    Monster,
    Player,
} from "$lib/server/crossover/redis/entities";
import type { GameActionEntities, TokenPositions } from "../ir";
import { getEntityId } from "../utils";
import { TICKS_PER_TURN } from "./settings";

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
    | "rest";

type ActionTargets = EntityType | "none";

interface Action {
    action: Actions;
    description: string;
    predicate: {
        target: ActionTargets[];
        tokenPositions: Record<string, number>;
    };
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
    },
    rest: {
        action: "rest",
        description: "Rest and recover.",
        predicate: {
            target: ["none"],
            tokenPositions: { action: 0 },
        },
        ticks: TICKS_PER_TURN * 4,
        icon: {
            path: "actions/actions",
            icon: "night-sleep",
        },
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
}): null | GameActionEntities {
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
        return null;
    }

    // Find target type in monsters, players, and items
    for (const targetType of targetTypes) {
        let highestScoringItem = null;
        let score = 0;
        let targetList: (Player | Monster | Item)[] = [];

        if (targetType === "monster") {
            targetList = monsters;
        } else if (targetType === "player") {
            targetList = players;
        } else if (targetType === "item") {
            targetList = items;

            // Can't drop/equip/unquip an item if it's not in the inventory
            if (
                [
                    actions.drop.action,
                    actions.equip.action,
                    actions.unequip.action,
                ].includes(action.action)
            ) {
                targetList = targetList.filter(
                    (item) =>
                        item.locT === "inv" &&
                        item.loc[0] === getEntityId(self)[0],
                );
            }

            // Can't take an item in the inventory
            if (action.action === actions.take.action) {
                targetList = targetList.filter((item) => item.locT !== "inv");
            }
        } else {
            continue;
        }

        for (const target of targetList) {
            const [entityId, entityType] = getEntityId(target);

            // Check target token position
            if (
                targetTokenPosition != null &&
                !(targetTokenPosition in tokenPositions[entityId])
            ) {
                continue;
            }
            // Find the highest scoring item
            if (tokenPositions[entityId][targetTokenPosition].score > score) {
                highestScoringItem = target;
                score = tokenPositions[entityId][targetTokenPosition].score;
            }
        }

        if (highestScoringItem != null) {
            return { self, target: highestScoringItem };
        }
    }

    // If no target is allowed
    if (targetTypes.includes("none")) {
        return { self };
    }

    return null;
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
];
