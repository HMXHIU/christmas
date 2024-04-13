import type {
    EntityType,
    Item,
    Monster,
    Player,
} from "$lib/server/crossover/redis/entities";
import type { GameActionEntities, TokenPositions } from "./ir";

export { actions, resolveActionEntities, type Action };

type Actions = "look" | "say" | "move";
// | "equip"
// | "unequip"
// | "take"
// | "drop"
// | "create";

type ActionTargets = EntityType | "none";

interface Action {
    action: Actions;
    description: string;
    predicate: {
        target: ActionTargets[];
        tokenPositions: Record<string, number>;
    };
}

const actions: Record<Actions, Action> = {
    look: {
        action: "look",
        description: "Look at the surroundings.",
        predicate: {
            target: ["player", "monster", "item", "none"],
            tokenPositions: { action: 0, target: 1 },
        },
    },
    say: {
        action: "say",
        description: "Say something.",
        predicate: {
            target: ["player", "monster", "none"],
            tokenPositions: { action: 0, target: 1 },
        },
    },
    move: {
        action: "move",
        description: "Move in a direction.",
        predicate: {
            target: ["none"],
            tokenPositions: { action: 0 },
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
        (!(action.action in tokenPositions) ||
            !(actionTokenPosition in tokenPositions[action.action]))
    ) {
        return null;
    }

    // Check target token position
    if (
        targetTokenPosition != null &&
        !targetTypes.includes("none") &&
        !(targetTokenPosition === queryTokens.length)
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
