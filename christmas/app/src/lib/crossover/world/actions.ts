import type {
    EntityType,
    Item,
    Monster,
    Player,
} from "$lib/server/crossover/redis/entities";
import type { GameActionEntities, TokenPositions } from "../ir";
import { getEntityId } from "../utils";
import { compendium } from "./settings/compendium";
import type { SkillLines } from "./skills";
import {
    EquipmentSlots,
    geohashLocationTypes,
    type BarterSerialized,
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
    | "learn"
    | "buy"
    | "sell"
    | "writ"
    | "browse"
    | "accept"
    | "fulfill"
    | "rest";

type ActionTargets = EntityType | "none";

type SpecialTokens = "action" | "target" | "skill" | "offer" | "receive";

interface Action {
    action: Actions;
    description: string;
    predicate: {
        target: ActionTargets[];
        tokenPositions: Partial<Record<SpecialTokens, number>>;
    };
    range: number;
    ticks: number;
    icon: IconAssetMetadata;
}

interface IconAssetMetadata {
    path: string; // eg. bundle/alias
    icon: string;
}

const tradingNotes = `Notes:
- Items must have a full charge and durability when traded, you are not alowed to buy and sell faulty goods!
- For currencies use the amount followed by lum for lumina and umb for umbra WITHOUT space (eg. 100lum, 50umb)
- For including multiple items and currencies join then using a ',' WITHOUT space (eg. woodenclub_2,50umb)`;

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
    accept: {
        action: "accept",
        description: `Accept a transaction request.

Command:
    accept [pin]
    
Examples:
    **accept** 1234`,
        predicate: {
            target: ["none"],
            tokenPositions: { action: 0, target: 3 }, //
        },
        ticks: 0, // accept should be 0 ticks as the actual action will have ticks
        icon: {
            path: "actions/actions",
            icon: "night-sleep",
        },
        range: 0,
    },
    learn: {
        action: "learn",
        description: `Learn a skill from a teacher.

Command: learn [skill] from [teacher]

Examples:
    **learn** exploration **from** gandalf`,
        predicate: {
            target: ["player"],
            tokenPositions: { action: 0, skill: 1, target: 3 },
        },
        ticks: 4,
        icon: {
            path: "actions/actions",
            icon: "night-sleep",
        },
        range: 0,
    },
    buy: {
        action: "buy",
        description: `Request to buy goods from a player.

Command:
    buy [offer,] from [player] for [receive,]

Examples:
    **buy** woodenclub from gandalf **for** 100lum
    **buy** woodenclub,potionofhealth from saruman **for** 50lum,50umb

${tradingNotes}`,
        predicate: {
            target: ["player"],
            tokenPositions: { action: 0, offer: 1, target: 3, receive: 5 },
        },
        ticks: 1,
        icon: {
            path: "actions/actions",
            icon: "night-sleep",
        },
        range: 0,
    },
    sell: {
        action: "sell",
        description: `Request to sell goods to a player.

Command:
    sell [offer,] to [player] for [receive,]
        
Examples:
    **sell** woodenclub_1 to gandalf **for** 100lum
    **sell** woodenclub_2,potionofhealth_3 to saruman **for** 50lum,50umb

${tradingNotes}`,
        predicate: {
            target: ["player"],
            tokenPositions: { action: 0, offer: 1, target: 3, receive: 5 },
        },
        ticks: 1,
        icon: {
            path: "actions/actions",
            icon: "night-sleep",
        },
        range: 0,
    },
    writ: {
        action: "writ",
        description: `Create a trade writ for buying and selling goods.
        
Commands:
    writ buy [offer,] for [receive,]
    writ sell [offer,] for [receive,]
        
Examples:
    Create a buy writ:
    **writ buy** woodenclub **for** 100lum
    **writ buy** woodenclub,potionofhealth **for** 50lum,50umb

    Create a sell writ:
    **writ sell** woodenclub_1 **for** 100lum
    **writ sell** woodenclub_2,potionofhealth_3 **for** 50lum,50umb

${tradingNotes}`,
        predicate: {
            target: ["none"],
            tokenPositions: { action: 0 },
        },
        ticks: 1,
        icon: {
            path: "actions/actions",
            icon: "night-sleep",
        },
        range: 0,
    },
    fulfill: {
        action: "fulfill",
        description: "Fulfill writ agreement.",
        predicate: {
            target: ["item"],
            tokenPositions: { action: 0 },
        },
        ticks: 0, // fulfill should be 0 ticks as the actual action will have ticks
        icon: {
            path: "actions/actions",
            icon: "night-sleep",
        },
        range: 0,
    },
    browse: {
        action: "browse",
        description: "Browse the goods a merchant is selling or buying.",
        predicate: {
            target: ["player"],
            tokenPositions: { action: 0, target: 1 },
        },
        ticks: 1,
        icon: {
            path: "actions/actions",
            icon: "night-sleep",
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
};

function parseBarter(barterString: string): BarterSerialized | undefined {
    let umb = 0;
    let lum = 0;
    let items = [];
    let ok = false;
    for (const s of barterString.split(",")) {
        if (s.endsWith("lum")) {
            lum = parseInt(s); // will parse the numbers only
            ok = true;
        } else if (s.endsWith("umb")) {
            umb = parseInt(s); // will parse the numbers only
            ok = true;
        } else if (s.startsWith("item")) {
            items.push(s);
            ok = true;
        }
    }
    if (!ok) {
        return undefined;
    } else {
        return {
            items,
            currency: {
                lum,
                umb,
            },
        };
    }
}

function resolveActionEntities({
    queryTokens,
    tokenPositions,
    action,
    self,
    monsters,
    players,
    items,
    skills,
}: {
    queryTokens: string[];
    tokenPositions: TokenPositions;
    action: Action;
    self: Player | Monster;
    monsters: Monster[];
    players: Player[];
    items: Item[];
    skills: SkillLines[];
}): GameActionEntities[] {
    const { target: targetTypes, tokenPositions: predicateTokenPositions } =
        actions[action.action].predicate;
    const {
        action: actionTokenPosition,
        target: targetTokenPosition,
        skill: skillTokenPosition,
        receive: receiveTokenPosition,
        offer: offerTokenPosition,
    } = predicateTokenPositions;

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

    let receive: BarterSerialized | undefined = undefined;
    let offer: BarterSerialized | undefined = undefined;

    // Check offer & receive token position
    if (receiveTokenPosition != null) {
        receive = parseBarter(queryTokens[receiveTokenPosition]);
        if (!receive) {
            return [];
        }
    }
    if (offerTokenPosition != null) {
        offer = parseBarter(queryTokens[offerTokenPosition]);
        if (!offer) {
            return [];
        }
    }

    // Check skill token position
    const skill = skills.find((s) => tokenPositions[s]);
    if (skillTokenPosition != null && skill == null) {
        return [];
    }

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
                targetTokenPosition &&
                targetTokenPosition in tokenPositions[entityId]
            ) {
                gameActionEntitiesScores.push([
                    {
                        self,
                        target,
                        skill,
                        offer,
                        receive,
                    },
                    tokenPositions[entityId][targetTokenPosition].score,
                ]);
            }
        }
    }

    // If no target is allowed
    if (gameActionEntitiesScores.length === 0 && targetTypes.includes("none")) {
        return [{ self, skill }];
    }

    // Sort by score
    return gameActionEntitiesScores
        .sort((a, b) => b[1] - a[1])
        .map((a) => a[0]);
}

// TODO: TO Deprecate, get actions from player skills
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
    actions.accept,
    actions.learn,
    actions.buy,
    actions.sell,
    actions.fulfill,
    actions.writ,
];
