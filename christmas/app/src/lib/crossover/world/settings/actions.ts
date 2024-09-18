import type { Action, Actions } from "../actions";

export { actions, playerActions };

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
        synonyms: ["greet"],
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
    trade: {
        action: "trade",
        description: `Request to trade goods with a player.

Command:
    trade [offer,] for [receive,] with [player]

Examples:
    Buy items:
    **trade** 100lum **for** woodenclub **with** gandalf
    **trade** 50lum,50umb **for** woodenclub,potionofhealth **with** saruman

    Sell items:
    **trade** woodenclub_1 **for** 100lum **with** gandalf
    **trade** woodenclub_2,potionofhealth_3 **for** 50lum,50umb **with** saruman

    Trade items:
    **trade** woodenclub_1 **for** potionofhealth **with** gandalf

${tradingNotes}`,
        predicate: {
            target: ["player"],
            tokenPositions: { action: 0, offer: 1, receive: 3, target: 5 },
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
    writ trade [offer,] for [receive,]
        
Examples:
    Buy items:
    **writ trade** 100lum **for** woodenclub
    **writ trade** 50lum,50umb **for** woodenclub,potionofhealth

    Sell items:
    **writ trade** woodenclub_1 **for** 100lum
    **writ trade** woodenclub_2,potionofhealth_3 **for** 50lum,50umb

    Trade items:
    **writ trade** woodenclub_1 **for** potionofhealth

${tradingNotes}`,
        predicate: {
            target: ["none"],
            tokenPositions: { action: 0, offer: 2, receive: 4 },
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
        description: `Fulfill a writ agreement.
        
Commands:
    fulfill [writ]

Examples:
    fufill item_tradewrit_1
`,
        predicate: {
            target: ["item"],
            tokenPositions: { action: 0, target: 1 },
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
    give: {
        action: "give",
        description: `Give an item to a player.

Commands:
    give [item] to [player]

Examples:
    **give** item_potionofhealth_1 **to** gandalf
`,
        predicate: {
            target: ["player"],
            tokenPositions: { action: 0, item: 1, target: 3 },
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
    actions.trade,
    actions.fulfill,
    actions.writ,
];
