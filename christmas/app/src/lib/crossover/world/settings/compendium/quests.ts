import type { Prop } from "../../compendium";

export let quests: Record<string, Prop> = {
    questwrit: {
        prop: "questwrit",
        asset: {
            path: "props/writ", // TODO: Add asset
        },
        durability: 1,
        charges: 1,
        weight: 1,
        collider: false,
        states: {
            default: {
                name: "${name}",
                destructible: false,
                description:
                    "A formal agreement for the quest '${name}'.\n\n${description}.",
                variant: "default",
            },
        },
        utilities: {},
        variables: {
            name: {
                variable: "name",
                type: "string",
                value: "Quest Writ", // default
            },
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
        asset: {
            path: "props/quest", // TODO: Add asset
        },
        durability: 1,
        charges: 1,
        weight: 1,
        collider: false,
        states: {
            default: {
                name: "${name}",
                destructible: false,
                description: "${description}",
                variant: "default",
            },
        },
        utilities: {},
        variables: {
            name: {
                variable: "name",
                type: "string",
                value: "",
            },
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
};
