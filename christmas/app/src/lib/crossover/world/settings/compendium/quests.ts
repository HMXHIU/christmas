import type { Prop } from "../../compendium";

export let quests: Record<string, Prop> = {
    questwrit: {
        prop: "questwrit",
        defaultName: "Quest writ",
        asset: {
            path: "props/writ", // TODO: Add asset
        },
        durability: 1,
        charges: 1,
        weight: 1,
        collider: false,
        defaultState: "default",
        states: {
            default: {
                destructible: false,
                description:
                    "A formal agreement detailing a quest and its rewards. ${description}.",
                variant: "default",
            },
        },
        utilities: {},
        variables: {
            description: {
                variable: "description",
                type: "string",
                value: "",
            },
            quest: {
                variable: "quest",
                type: "string",
                value: "",
            },
        },
    },
    questitem: {
        prop: "questitem",
        defaultName: "Quest item",
        asset: {
            path: "props/quest", // TODO: Add asset
        },
        durability: 1,
        charges: 1,
        weight: 1,
        collider: false,
        defaultState: "default",
        states: {
            default: {
                destructible: false,
                description: "${description}",
                variant: "default",
            },
        },
        utilities: {},
        variables: {
            description: {
                variable: "description",
                type: "string",
                value: "",
            },
        },
    },
};
