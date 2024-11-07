import type { Prop } from "../../compendium";
import { abilities } from "../abilities";

export let architecture: Record<string, Prop> = {
    woodendoor: {
        prop: "woodendoor",
        asset: {
            path: "props/gothic",
            variants: {
                open: "wood-door-2",
                closed: "wood-door-1",
            },
        },
        durability: 100,
        charges: 0,
        weight: -1,
        collider: true,
        states: {
            default: {
                name: "Wooden Door",
                destructible: false,
                description: "${doorsign}. The door is closed.",
                variant: "closed",
            },
            open: {
                name: "Wooden Door",
                destructible: false,
                description: "${doorsign}. The door is open.",
                variant: "open",
            },
        },
        utilities: {
            open: {
                utility: "open",
                description: "Open the door.",
                cost: {
                    charges: 0,
                    durability: 0,
                },
                range: 1,
                state: {
                    start: "default",
                    end: "open",
                },
            },
            close: {
                utility: "close",
                description: "Close the door.",
                cost: {
                    charges: 0,
                    durability: 0,
                },
                range: 1,
                state: {
                    start: "open",
                    end: "default",
                },
            },
        },
        variables: {
            doorsign: {
                variable: "doorsign",
                type: "string",
                value: "Just a plain wooden door",
            },
        },
    },
    tavern: {
        prop: "tavern",
        // TODO: Add tavern asset
        asset: {
            path: "props/gothic",
            variants: {
                default: "wood-door-1",
            },
            width: 2,
            height: 2,
        },
        durability: 100,
        charges: 0,
        weight: -1, // cannot be taken
        collider: true,
        states: {
            default: {
                name: "Tavern",
                destructible: false,
                description: "A humble tavern. ${description}",
                variant: "default",
            },
        },
        world: {
            locationInstance: "{{self.item}}",
            locationType: "in",
            geohash: "{{self.loc[0]}}",
            world: "{{self.item}}",
            uri: "${uri}", // the uri to the world asset to spawn when entering the tavern
        },
        utilities: {},
        variables: {
            description: {
                variable: "description",
                type: "string",
                value: "A plain wooden door of the tavern greets you.",
            },
            uri: {
                variable: "uri",
                type: "string",
                value: "tavern.json", // TESTING DEFAULT
            },
        },
    },
    debris: {
        prop: "debris",
        asset: {
            path: "props/gothic",
            variants: {
                default: "debris-9",
            },
            width: 2,
            height: 2,
        },
        durability: 100,
        charges: 0,
        weight: -1, // cannot be taken
        collider: true,
        states: {
            default: {
                name: "Debris",
                destructible: false,
                description: "Impassable debris",
                variant: "default",
            },
        },
        utilities: {},
        variables: {},
    },
    portal: {
        prop: "portal",
        asset: {
            path: "props/gothic",
            variants: {
                default: "ritual-circle",
            },
            width: 2,
            height: 2,
        },
        durability: 100,
        charges: 100,
        weight: -1,
        collider: false,
        states: {
            default: {
                name: "${name}",
                destructible: false,
                description: "${description}",
                variant: "default",
            },
        },
        variables: {
            name: {
                variable: "name",
                type: "string",
                value: "Portal",
            },
            description: {
                variable: "description",
                type: "string",
                value: "A portal pulsing with magical energy",
            },
            // Can be used to overwrite `target` or `self` provided by `useItem`
            target: {
                variable: "target",
                type: "item", // a portal's target is the item to teleport to (eg. another portal)
                value: "",
            },
        },
        utilities: {
            teleport: {
                utility: "teleport",
                description: "Step through the portal.",
                cost: {
                    charges: 1,
                    durability: 0,
                },
                state: {
                    start: "default",
                    end: "default",
                },
                ability: abilities.teleport.ability,
            },
        },
    },
    // An invisible portal used for exiting a world
    exit: {
        prop: "exit",
        durability: 100,
        charges: 0,
        weight: -1,
        collider: false,
        states: {
            default: {
                name: "${name}",
                destructible: false,
                description: "${description}",
                variant: "default",
            },
        },
        variables: {
            name: {
                variable: "name",
                type: "string",
                value: "Exit",
            },
            description: {
                variable: "description",
                type: "string",
                value: "An exit leading out of the area.",
            },
            target: {
                variable: "target",
                type: "item",
                value: "",
            },
        },
        utilities: {
            use: {
                utility: "use",
                description: "Exit the area *[[use exit]]*.", // TODO: add link to copy to console for [[]]
                cost: {
                    charges: 0,
                    durability: 0,
                },
                state: {
                    start: "default",
                    end: "default",
                },
                ability: abilities.teleport.ability,
                range: 1,
            },
        },
    },
};
