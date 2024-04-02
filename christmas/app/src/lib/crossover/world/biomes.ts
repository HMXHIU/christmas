import { type AssetMetadata } from ".";
import { worldSeed } from "./seed";
export { biomes, type Biome };

interface Biome {
    biome: string;
    name: string;
    description: string;
    traversable: number; // 0.0 - 1.0
    asset?: AssetMetadata;
}

let biomes: Record<string, Biome> = {
    forest: {
        biome: "forest",
        name: "Forest",
        description:
            "A dense collection of trees and vegetation, home to a variety of wildlife.",
        traversable: 0.8,
        asset: {
            bundle: "biomes",
            name: "tree",
            animations: {
                sway: "sway",
            },
            variants: {
                default: "sway/0",
                1: "sway/1",
                2: "sway/2",
                3: "sway/3",
                4: "sway/4",
                dead: "stump",
            },
            width: 1,
            height: 1,
            precision: worldSeed.spatial.unit.precision,
        },
    },
    desert: {
        biome: "desert",
        name: "Desert",
        description:
            "A dry, arid region with extreme temperatures, sparse vegetation, and limited wildlife.",
        traversable: 1.0,
    },
    tundra: {
        biome: "tundra",
        name: "Tundra",
        description:
            "A cold, treeless area with a frozen subsoil, limited vegetation, and adapted wildlife.",
        traversable: 1.0,
    },
    grassland: {
        biome: "grassland",
        name: "Grassland",
        description:
            "A region dominated by grasses, with few trees and a diverse range of wildlife.",
        traversable: 1.0,
    },
    wetland: {
        biome: "wetland",
        name: "Wetland",
        description:
            "An area saturated with water, supporting aquatic plants and a rich biodiversity.",
        traversable: 0.5,
    },
    mountain: {
        biome: "mountain",
        name: "Mountain",
        description:
            "A high elevation region with steep terrain, diverse ecosystems, and unique wildlife.",
        traversable: 0,
    },
    hills: {
        biome: "hills",
        name: "Hills",
        description:
            "A region of elevated terrain, with a variety of wildlife.",
        traversable: 0.5,
    },
    plains: {
        biome: "plains",
        name: "Plains",
        description: "A large area of flat land, with a variety of wildlife.",
        traversable: 1.0,
    },
    swamp: {
        biome: "swamp",
        name: "Swamp",
        description:
            "A wetland area with a variety of vegetation, supporting a diverse range of wildlife.",
        traversable: 0.7,
    },
    water: {
        biome: "water",
        name: "Water",
        description: "A large body of water, with a variety of aquatic life.",
        traversable: 0,
        asset: {
            bundle: "biomes",
            name: "water",
            variants: {
                default: "Water",
            },
            width: 1,
            height: 1,
            precision: worldSeed.spatial.unit.precision,
        },
    },
};
