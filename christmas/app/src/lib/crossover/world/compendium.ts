import type { AssetMetadata } from ".";
import { abilities } from "./abilities";

export { compendium, type Prop };

/**
 * `Prop` is a template used to create an `item` instance
 */
interface Prop extends PropStats {
    prop: string;
    defaultName: string;
    defaultState: string;
    asset: AssetMetadata;
    states: Record<string, PropAttributes>;
    actions?: Record<string, PropAction>;
    variables?: PropVariables; // configurable variables to alter prop behavior & descriptions
}

interface PropStats {
    durability: number;
    charges: number; // needs to be recharged (every day or via item)
}

interface PropAttributes {
    description: string;
    traversable: number;
    desctructible: boolean;
    variant: string;
}

interface PropAction {
    description: string;
    cost: {
        charges: number;
    };
    state: {
        start: string;
        end: string;
    };
    ability?: {
        ability: string; // abilities[ability]
        self: string; // player.player || monster.monster || item.item
        target: string; // player.player || monster.monster || item.item
    };
}

interface PropVariables {
    [key: string]: string;
}

/**
 * `compendium` is a collection of `Prop` templates used  to create `item` instances.
 */
let compendium: Record<string, Prop> = {
    woodenDoor: {
        prop: "woodenDoor",
        defaultName: "Wooden Door",
        asset: {
            bundle: "props",
            name: "gothic",
            variants: {
                default: "wood-door-1",
                closed: "wood-door-2",
            },
        },
        defaultState: "closed",
        durability: 100,
        charges: 0,
        states: {
            open: {
                traversable: 1.0,
                desctructible: false,
                description: "${doorSign}. The door is open.",
                variant: "default",
            },
            closed: {
                traversable: 0,
                desctructible: false,
                description: "${doorSign}. The door is closed.",
                variant: "closed",
            },
        },
        actions: {
            open: {
                description: "Open the door.",
                cost: {
                    charges: 0,
                },
                state: {
                    start: "closed",
                    end: "open",
                },
            },
            close: {
                description: "Close the door.",
                cost: {
                    charges: 0,
                },
                state: {
                    start: "open",
                    end: "closed",
                },
            },
        },
        variables: {
            doorSign: "Just a plain wooden door",
        },
    },
    portal: {
        prop: "portal",
        defaultName: "Portal",
        asset: {
            bundle: "props",
            name: "gothic",
            variants: {
                default: "ritual-circle",
            },
        },
        durability: 100,
        charges: 100,
        defaultState: "default",
        states: {
            default: {
                traversable: 1.0,
                desctructible: false,
                description:
                    "${description}. It is tuned to teleport to ${target}.",
                variant: "default",
            },
        },
        variables: {
            target: "", // player.player || monster.monster || item.item
            description: "A portal pulsing with magical energy",
        },
        actions: {
            teleport: {
                description: "Step through the portal.",
                cost: {
                    charges: 1,
                },
                state: {
                    start: "default",
                    end: "default",
                },
                ability: {
                    ability: abilities.teleport.ability,
                    self: "${player}", // special variable always available
                    target: "${target}",
                },
            },
        },
    },
};
