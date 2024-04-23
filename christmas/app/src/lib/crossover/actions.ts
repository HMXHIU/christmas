import type {
    EntityType,
    Item,
    Monster,
    Player,
} from "$lib/server/crossover/redis/entities";
import type { GameActionEntities, TokenPositions } from "./ir";
import { TICKS_PER_TURN } from "./world/settings";

export {
    actions,
    playerActions,
    resolveActionEntities,
    type Action,
    type Actions,
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
}

const actions: Record<Actions, Action> = {
    look: {
        action: "look",
        description: "Look at the surroundings.",
        predicate: {
            target: ["player", "monster", "item", "none"],
            tokenPositions: { action: 0, target: 1 },
        },
        ticks: 1,
    },
    say: {
        action: "say",
        description: "Say something.",
        predicate: {
            target: ["player", "monster", "none"],
            tokenPositions: { action: 0, target: 1 },
        },
        ticks: 1,
    },
    move: {
        action: "move",
        description: "Move in a direction.",
        predicate: {
            target: ["none"],
            tokenPositions: { action: 0 },
        },
        ticks: 1,
    },
    take: {
        action: "take",
        description: "Take an item.",
        predicate: {
            target: ["item"],
            tokenPositions: { action: 0, target: 1 },
        },
        ticks: 1,
    },
    drop: {
        action: "drop",
        description: "Drop an item.",
        predicate: {
            target: ["item"],
            tokenPositions: { action: 0, target: 1 },
        },
        ticks: 1,
    },
    equip: {
        action: "equip",
        description: "Equip an item.",
        predicate: {
            target: ["item"],
            tokenPositions: { action: 0, target: 1 },
        },
        ticks: 1,
    },
    unequip: {
        action: "unequip",
        description: "Unequip an item.",
        predicate: {
            target: ["item"],
            tokenPositions: { action: 0, target: 1 },
        },
        ticks: 1,
    },
    create: {
        action: "create",
        description: "Create an item.",
        predicate: {
            target: ["none"],
            tokenPositions: { action: 0 },
        },
        ticks: 1,
    },
    configure: {
        action: "configure",
        description: "Configure an item.",
        predicate: {
            target: ["item"],
            tokenPositions: { action: 0, target: 1 },
        },
        ticks: 1,
    },
    inventory: {
        action: "inventory",
        description: "View inventory.",
        predicate: {
            target: ["none"],
            tokenPositions: { action: 0 },
        },
        ticks: 0,
    },
    rest: {
        action: "rest",
        description: "Rest and recover.",
        predicate: {
            target: ["none"],
            tokenPositions: { action: 0 },
        },
        ticks: TICKS_PER_TURN * 4,
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
        (!(action.action in tokenPositions) ||
            !(actionTokenPosition in tokenPositions[action.action]))
    ) {
        return null;
    }

    // Find target type in monsters
    if (targetTypes.includes("monster")) {
        for (const m of monsters) {
            // Check target token position
            if (
                targetTokenPosition != null &&
                !(targetTokenPosition in tokenPositions[m.monster])
            ) {
                continue;
            }
            return { self, target: m }; // early return
        }
    }

    // Find target type in players
    if (targetTypes.includes("player")) {
        for (const p of players) {
            // Check target token position
            if (
                targetTokenPosition != null &&
                !(targetTokenPosition in tokenPositions[p.player])
            ) {
                continue;
            }
            return { self, target: p }; // early return
        }
    }

    // Find target type in items
    if (targetTypes.includes("item")) {
        for (const i of items) {
            // Check target token position
            if (
                targetTokenPosition != null &&
                !(targetTokenPosition in tokenPositions[i.item])
            ) {
                continue;
            }
            return { self, target: i }; // early return
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
