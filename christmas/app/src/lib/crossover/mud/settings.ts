import type { EntityType } from "../types";
import type { BiomeType } from "../world/biomes";

export {
    biomeDescriptors,
    entityDescriptors,
    type BiomeDescriptors,
    type EntityDescriptionState,
    type EntityDescriptors,
};

interface BiomeMixDescription {
    condition: (primary: BiomeType, secondary: BiomeType) => boolean;
    description: string;
}

interface BiomeDescriptors {
    biomeDescriptors: { [key in BiomeType]: string[] };
    elevationDescriptors: string[];
    timeDescriptors: string[];
    biomeMixDescriptions: BiomeMixDescription[];
    defaultMixDescription: string;
    secondaryBiomeThreshold: number;
}

type EntityDescriptionState = "default" | "destroyed";

type EntityDescriptors = {
    descriptors: [number, Record<EntityDescriptionState, string>][];
};

const biomeDescriptors: BiomeDescriptors = {
    biomeDescriptors: {
        grassland: [
            "rolling meadows of green and gold",
            "windswept plains where grasses dance",
            "verdant fields stretching to the horizon",
        ],
        forest: [
            "ancient trees with gnarled roots and whispering leaves",
            "mysterious woods where shadows play",
            "a canopy of green filtering dappled sunlight",
        ],
        desert: [
            "sun-baked sands shimmering like a mirage",
            "vast dunes sculpted by timeless winds",
            "a barren expanse where heat ripples the air",
        ],
        tundra: [
            "frost-kissed plains under an endless sky",
            "a stark beauty of ice and snow",
            "hardy shrubs clinging to life in the cold",
        ],
        underground: [
            "echoing caverns adorned with glittering crystals",
            "a labyrinth of stone where darkness dwells",
            "hidden passages carved by time and water",
        ],
        aquatic: [
            "crystal waters teeming with life unseen",
            "gentle waves lapping at the shore",
            "depths that hold secrets of ages past",
        ],
    },
    elevationDescriptors: [
        "In the lowlands, ",
        "Across the rolling hills, ",
        "High upon the mountainside, ",
    ],
    timeDescriptors: [
        "Time seems to slow in this timeless place. ",
        "Here, the ages of the world whisper their secrets. ",
        "In this land, every stone could tell a tale of old. ",
    ],
    biomeMixDescriptions: [
        {
            condition: (primary, secondary) =>
                primary === "grassland" && secondary === "forest",
            description:
                "groves of trees stand like islands in a sea of grass. ",
        },
        {
            condition: (primary, secondary) =>
                primary === "desert" && secondary === "grassland",
            description: "patches of hardy grass defy the arid landscape. ",
        },
        {
            condition: (primary, secondary) =>
                primary === "tundra" && secondary === "forest",
            description: "stunted trees huddle together against the cold. ",
        },
    ],
    defaultMixDescription: " intrudes upon the scene. ",
    secondaryBiomeThreshold: 0.3,
};
const entityDescriptors: Record<EntityType, EntityDescriptors> = {
    player: {
        descriptors: [
            [
                1,
                {
                    default: "{name} is here",
                    destroyed: "The corpse of {name} lies here",
                },
            ],
            [
                2,
                {
                    default: "{name} and {name} are here",
                    destroyed: "The corpses of {name} and {name} lie here",
                },
            ],
            [
                3,
                {
                    default: "{name}, {name}, and {name} are here",
                    destroyed:
                        "The corpses of {name}, {name}, and {name} lie here",
                },
            ],
            [
                5,
                {
                    default: "{names}, and {name} are here",
                    destroyed: "The corpses of {names}, and {name} lie here",
                },
            ],
            [
                10,
                {
                    default:
                        "A small group of {count} adventurers are gathered here",
                    destroyed:
                        "The corpses of {count} adventurers litter the ground",
                },
            ],
            [
                20,
                {
                    default: "A band of {count} adventurers are gathered here",
                    destroyed:
                        "A grim scene of {count} fallen adventurers is before you",
                },
            ],
            [
                Infinity,
                {
                    default:
                        "A massive gathering of {count} adventurers is here",
                    destroyed:
                        "A horrific mass of {count} fallen adventurers covers the area",
                },
            ],
        ],
    },
    monster: {
        descriptors: [
            [
                1,
                {
                    default: "You see a {name}",
                    destroyed: "You see the remains of a {name}",
                },
            ],
            [
                2,
                {
                    default: "You see a pair of {name}s",
                    destroyed: "You see the remains of two {name}s",
                },
            ],
            [
                5,
                {
                    default: "You see a small group of {count} {name}s",
                    destroyed:
                        "You see the remains of {count} {name}s scattered about",
                },
            ],
            [
                10,
                {
                    default: "You see a pack of {count} {name}s",
                    destroyed:
                        "You see a gruesome pile of {count} {name} corpses",
                },
            ],
            [
                Infinity,
                {
                    default: "You see a horde of {count} {name}s",
                    destroyed: "You see a vast field of {count} slain {name}s",
                },
            ],
        ],
    },
    item: {
        descriptors: [
            [
                1,
                {
                    default: "You see a {name}",
                    destroyed: "You see a destroyed {name}",
                },
            ],
            [
                5,
                {
                    default: "You see {count} {name}s",
                    destroyed: "You see {count} ruined {name}s",
                },
            ],
            [
                Infinity,
                {
                    default: "You see {count} {name}s",
                    destroyed: "You see {count} destroyed {name}s",
                },
            ],
        ],
    },
};
