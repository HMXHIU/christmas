import { GAME_MORPHOLOGY_IMAGES } from "$lib/crossover/defs";
import type { Prop } from "../../compendium";
import { tints } from "../../materials";

export let equipment: Record<string, Prop> = {
    /**
     * Equipment - armour
     */
    steelplate: {
        prop: "steelplate",
        asset: {
            path: `${GAME_MORPHOLOGY_IMAGES}/female_steel_plate/torso.png`,
        },
        equipment: {
            slot: "ch",
            attributes: {
                dex: -2,
            },
            damageReduction: { fixed: 4, percent: 0.4 },
            assets: {
                torsoBone: {
                    // TODO: to change assets to exclude demographics which should be replaced by each player (eg. steel_plate only)
                    asset: {
                        path: `${GAME_MORPHOLOGY_IMAGES}/female_steel_plate/torso.png`,
                    },
                    tint: tints.black,
                },
            },
        },
        durability: 100,
        charges: 0,
        weight: 20,
        collider: false,
        states: {
            default: {
                name: "Steel plate armor",
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
        asset: {
            path: `${GAME_MORPHOLOGY_IMAGES}/female_steel_plate/front_upper_leg.png`,
        },
        equipment: {
            slot: "lg",
            damageReduction: { fixed: 4, percent: 0.4 },
            assets: {
                frontUpperLegBone: {
                    asset: {
                        path: `${GAME_MORPHOLOGY_IMAGES}/female_steel_plate/front_upper_leg.png`,
                    },
                    tint: tints.black,
                },
                backUpperLegBone: {
                    asset: {
                        path: `${GAME_MORPHOLOGY_IMAGES}/female_steel_plate/back_upper_leg.png`,
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
        },
        durability: 100,
        charges: 0,
        weight: 20,
        collider: false,
        states: {
            default: {
                name: "Steel leg armor",
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
        asset: {
            path: `${GAME_MORPHOLOGY_IMAGES}/female_steel_plate/front_lower_leg.png`,
        },
        equipment: {
            slot: "ft",
            damageReduction: { fixed: 4, percent: 0.4 },
            assets: {
                frontLowerLegBone: {
                    asset: {
                        path: `${GAME_MORPHOLOGY_IMAGES}/female_steel_plate/front_lower_leg.png`,
                    },
                    replace: true,
                    tint: tints.none, // replace and remove tints added from other armor
                },
                backLowerLegBone: {
                    asset: {
                        path: `${GAME_MORPHOLOGY_IMAGES}/female_steel_plate/back_lower_leg.png`,
                    },
                    replace: true,
                    tint: tints.none,
                },
            },
        },
        durability: 100,
        charges: 0,
        weight: 20,
        collider: false,
        states: {
            default: {
                name: "Steel boots",
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
        asset: {
            path: `${GAME_MORPHOLOGY_IMAGES}/female_steel_plate/front_upper_arm.png`,
        },
        equipment: {
            slot: "sh",
            damageReduction: { fixed: 4, percent: 0.4 },
            assets: {
                frontLowerArmBone: {
                    tint: tints.black,
                },
                backLowerArmBone: {
                    tint: tints.black,
                },
                frontUpperArmBone: {
                    asset: {
                        path: `${GAME_MORPHOLOGY_IMAGES}/female_steel_plate/front_upper_arm.png`,
                    },
                    tint: tints.black,
                },
                backUpperArmBone: {
                    asset: {
                        path: `${GAME_MORPHOLOGY_IMAGES}/female_steel_plate/back_upper_arm.png`,
                    },
                    tint: tints.black,
                },
            },
        },
        durability: 100,
        charges: 0,
        weight: 20,
        collider: false,
        states: {
            default: {
                name: "Steel Pauldrons",
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
        asset: {
            path: `${GAME_MORPHOLOGY_IMAGES}/female_steel_plate/front_lower_arm.png`,
        },
        equipment: {
            slot: "gl",
            damageReduction: { fixed: 4, percent: 0.4 },
            assets: {
                frontLowerArmBone: {
                    asset: {
                        path: `${GAME_MORPHOLOGY_IMAGES}/female_steel_plate/front_lower_arm.png`,
                    },
                    tint: tints.black,
                },
                backLowerArmBone: {
                    asset: {
                        path: `${GAME_MORPHOLOGY_IMAGES}/female_steel_plate/back_lower_arm.png`,
                    },
                    tint: tints.black,
                },
            },
        },
        durability: 100,
        charges: 0,
        weight: 20,
        collider: false,
        states: {
            default: {
                name: "Steel Gauntlets",
                destructible: true,
                description: "A simple set of steel gauntlets",
                variant: "default",
            },
        },
        utilities: {},
        variables: {},
    },
};
