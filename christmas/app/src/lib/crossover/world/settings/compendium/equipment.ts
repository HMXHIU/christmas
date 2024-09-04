import type { Prop } from "../../compendium";
import { tints } from "../../materials";

export let equipment: Record<string, Prop> = {
    /**
     * Equipment - armour
     */
    steelplate: {
        prop: "steelplate",
        defaultName: "Steel plate armor",
        asset: {
            path: "http://localhost:5173/avatar/images/female_steel_plate/torso.png",
        },
        equipmentAssets: {
            torsoBone: {
                asset: {
                    path: "http://localhost:5173/avatar/images/female_steel_plate/torso.png",
                },
                tint: tints.black,
            },
        },
        durability: 100,
        charges: 0,
        weight: 20,
        collider: false,
        equipmentSlot: ["ch"],
        defaultState: "default",
        states: {
            default: {
                variant: "default",
                destructible: true,
                description: "A simple steel plate of armor.",
            },
        },
        utilities: {},
        variables: {},
    },
    steelleg: {
        prop: "steelleg",
        defaultName: "Steel leg armor",
        asset: {
            path: "http://localhost:5173/avatar/images/female_steel_plate/front_upper_leg.png",
        },
        equipmentAssets: {
            frontUpperLegBone: {
                asset: {
                    path: "http://localhost:5173/avatar/images/female_steel_plate/front_upper_leg.png",
                },
                tint: tints.black,
            },
            backUpperLegBone: {
                asset: {
                    path: "http://localhost:5173/avatar/images/female_steel_plate/back_upper_leg.png",
                },
                tint: tints.black,
            },
            frontLowerLegBone: {
                tint: tints.black,
            },
            backLowerLegBone: {
                tint: tints.black,
            },
        },
        durability: 100,
        charges: 0,
        weight: 20,
        collider: false,
        equipmentSlot: ["lg"],
        defaultState: "default",
        states: {
            default: {
                destructible: true,
                description: "A simple steel armor worn on the legs",
                variant: "default",
            },
        },
        utilities: {},
        variables: {},
    },
    steelboot: {
        prop: "steelboot",
        defaultName: "Steel boots",
        asset: {
            path: "http://localhost:5173/avatar/images/female_steel_plate/front_lower_leg.png",
        },
        equipmentAssets: {
            frontLowerLegBone: {
                asset: {
                    path: "http://localhost:5173/avatar/images/female_steel_plate/front_lower_leg.png",
                },
                replace: true,
                tint: tints.none, // replace and remove tints added from other armor
            },
            backLowerLegBone: {
                asset: {
                    path: "http://localhost:5173/avatar/images/female_steel_plate/back_lower_leg.png",
                },
                replace: true,
                tint: tints.none,
            },
        },
        durability: 100,
        charges: 0,
        weight: 20,
        collider: false,
        equipmentSlot: ["ft"],
        defaultState: "default",
        states: {
            default: {
                destructible: true,
                description: "A simple set of steel boots",
                variant: "default",
            },
        },
        utilities: {},
        variables: {},
    },
    steelpauldron: {
        prop: "steelpauldron",
        defaultName: "Steel Pauldrons",
        asset: {
            path: "http://localhost:5173/avatar/images/female_steel_plate/front_upper_arm.png",
        },
        equipmentAssets: {
            frontLowerArmBone: {
                tint: tints.black,
            },
            backLowerArmBone: {
                tint: tints.black,
            },
            frontUpperArmBone: {
                asset: {
                    path: "http://localhost:5173/avatar/images/female_steel_plate/front_upper_arm.png",
                },
                tint: tints.black,
            },
            backUpperArmBone: {
                asset: {
                    path: "http://localhost:5173/avatar/images/female_steel_plate/back_upper_arm.png",
                },
                tint: tints.black,
            },
        },
        durability: 100,
        charges: 0,
        weight: 20,
        collider: false,
        equipmentSlot: ["sh"],
        defaultState: "default",
        states: {
            default: {
                destructible: true,
                description: "A simple set of steel pauldrons",
                variant: "default",
            },
        },
        utilities: {},
        variables: {},
    },
    steelgauntlet: {
        prop: "steelgauntlet",
        defaultName: "Steel Gauntlets",
        asset: {
            path: "http://localhost:5173/avatar/images/female_steel_plate/front_lower_arm.png",
        },
        equipmentAssets: {
            frontLowerArmBone: {
                asset: {
                    path: "http://localhost:5173/avatar/images/female_steel_plate/front_lower_arm.png",
                },
                tint: tints.black,
            },
            backLowerArmBone: {
                asset: {
                    path: "http://localhost:5173/avatar/images/female_steel_plate/back_lower_arm.png",
                },
                tint: tints.black,
            },
        },
        durability: 100,
        charges: 0,
        weight: 20,
        collider: false,
        equipmentSlot: ["gl"],
        defaultState: "default",
        states: {
            default: {
                destructible: true,
                description: "A simple set of steel gauntlets",
                variant: "default",
            },
        },
        utilities: {},
        variables: {},
    },
};
