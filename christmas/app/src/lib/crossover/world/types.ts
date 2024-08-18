import { type EquipmentSlot } from "./compendium";

export {
    Directions,
    type AssetMetadata,
    type Direction,
    type GridCell,
    type LocationType,
    type Tile,
    type WorldAssetMetadata,
};

interface Tile {
    geohash: string;
    name: string;
    description: string;
}

interface AssetMetadata {
    path: string; // eg. bundle/name or url (must start with http)
    animations?: Record<string, string>; // create an animation pointing to an in the sprite.json
    variants?: Record<string, string>; // create a variant pointing to a frame in the sprite.json
    prob?: Record<string, number>; // probability of each variant
    width?: number; // number of horizontal cells at the geohash precision, origin is always top left (default: 1)
    height?: number; // number of vertical cells at the geohash precision, origin is always top left (default: 1)
    precision?: number; // geohash precision (default: unit)
}

interface WorldAssetMetadata {
    layers: {
        data: number[];
        properties?: { name: string; value: any; type: string }[];
        offsetx?: number; // offset in pixels
        offsety?: number;
        height: number; // height in tiles
        width: number;
        name: string;
        type: "tilelayer";
        x: number; // x coordinate in tiles
        y: number;
    }[];
    height: number;
    width: number;
    tilewidth: number;
    tileheight: number;
}

type Direction = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw" | "u" | "d";
const Directions: Direction[] = [
    "n",
    "s",
    "e",
    "w",
    "ne",
    "nw",
    "se",
    "sw",
    "u",
    "d",
];

type InstancedWorldLocationType = string;

type LocationType =
    | "geohash" // environment
    | "d1"
    | "d2"
    | "d3"
    | "d4"
    | "d5"
    | "d6"
    | "d7"
    | "d8"
    | "d9"
    | "d10" // environment - underground levels
    | "item" // inside an item
    | "inv" // inventory
    | InstancedWorldLocationType // typically a player's publicKey (loc is still a list of geohashes)
    | EquipmentSlot; // equiped

type GridCell = {
    precision: number;
    row: number;
    col: number;
    geohash: string;
};
