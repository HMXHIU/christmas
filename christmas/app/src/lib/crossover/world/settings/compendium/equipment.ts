import { PUBLIC_MINIO_ENDPOINT } from "$env/static/public";
import type { Prop } from "../../compendium";
import { tints } from "../../materials";

export let equipment: Record<string, Prop> = {
    /**
     * Equipment - armour
     */
    steelplate: {
        prop: "steelplate",
        asset: {
            path: `${PUBLIC_MINIO_ENDPOINT}/game/avatar/morphology/images/female_steel_plate/torso.png`,
        },
        equipmentAssets: {
            torsoBone: {
                asset: {
                    path: `${PUBLIC_MINIO_ENDPOINT}/game/avatar/morphology/images/female_steel_plate/torso.png`,
                },
                tint: tints.black,
            },
        },
        durability: 100,
        charges: 0,
        weight: 20,
        collider: false,
        equipmentSlot: ["ch"],
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
            path: `${PUBLIC_MINIO_ENDPOINT}/game/avatar/morphology/images/female_steel_plate/front_upper_leg.png`,
        },
        equipmentAssets: {
            frontUpperLegBone: {
                asset: {
                    path: `${PUBLIC_MINIO_ENDPOINT}/game/avatar/morphology/images/female_steel_plate/front_upper_leg.png`,
                },
                tint: tints.black,
            },
            backUpperLegBone: {
                asset: {
                    path: `${PUBLIC_MINIO_ENDPOINT}/game/avatar/morphology/images/female_steel_plate/back_upper_leg.png`,
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
            path: `${PUBLIC_MINIO_ENDPOINT}/game/avatar/morphology/images/female_steel_plate/front_lower_leg.png`,
        },
        equipmentAssets: {
            frontLowerLegBone: {
                asset: {
                    path: `${PUBLIC_MINIO_ENDPOINT}/game/avatar/morphology/images/female_steel_plate/front_lower_leg.png`,
                },
                replace: true,
                tint: tints.none, // replace and remove tints added from other armor
            },
            backLowerLegBone: {
                asset: {
                    path: `${PUBLIC_MINIO_ENDPOINT}/game/avatar/morphology/images/female_steel_plate/back_lower_leg.png`,
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
            path: `${PUBLIC_MINIO_ENDPOINT}/game/avatar/morphology/images/female_steel_plate/front_upper_arm.png`,
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
                    path: `${PUBLIC_MINIO_ENDPOINT}/game/avatar/morphology/images/female_steel_plate/front_upper_arm.png`,
                },
                tint: tints.black,
            },
            backUpperArmBone: {
                asset: {
                    path: `${PUBLIC_MINIO_ENDPOINT}/game/avatar/morphology/images/female_steel_plate/back_upper_arm.png`,
                },
                tint: tints.black,
            },
        },
        durability: 100,
        charges: 0,
        weight: 20,
        collider: false,
        equipmentSlot: ["sh"],
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
            path: `${PUBLIC_MINIO_ENDPOINT}/game/avatar/morphology/images/female_steel_plate/front_lower_arm.png`,
        },
        equipmentAssets: {
            frontLowerArmBone: {
                asset: {
                    path: `${PUBLIC_MINIO_ENDPOINT}/game/avatar/morphology/images/female_steel_plate/front_lower_arm.png`,
                },
                tint: tints.black,
            },
            backLowerArmBone: {
                asset: {
                    path: `${PUBLIC_MINIO_ENDPOINT}/game/avatar/morphology/images/female_steel_plate/back_lower_arm.png`,
                },
                tint: tints.black,
            },
        },
        durability: 100,
        charges: 0,
        weight: 20,
        collider: false,
        equipmentSlot: ["gl"],
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
