import type { ItemEntity } from "$lib/server/crossover/types";
import { z } from "zod";
import type { Currency } from "../types";

export {
    BarterSchema,
    Directions,
    EQUIPMENT_SLOTS,
    equipmentSlotCapacity,
    equipmentSlots,
    EquipmentSlotsEnum,
    GeohashLocationSchema,
    geohashLocationTypes,
    weaponSlots,
    type AssetMetadata,
    type Barter,
    type BarterSerialized,
    type Direction,
    type EquipmentSlot,
    type GeohashLocation,
    type GridCell,
    type LocationType,
    type NoiseType,
    type ObjectLayer,
    type TileLayer,
    type WorldAssetMetadata,
};

interface Barter {
    items: ItemEntity[]; // when buying or selling specific item instances
    props: string[]; // when buying items by props
    currency: Record<Currency, number>;
}
type BarterSerialized = z.infer<typeof BarterSchema>;
const BarterSchema = z.object({
    items: z.array(z.string()).optional(),
    props: z.array(z.string()).optional(),
    currency: z
        .object({
            lum: z.number().optional(),
            umb: z.number().optional(),
        })
        .optional(),
});

const EQUIPMENT_SLOTS = {
    // armor
    ch: "chest",
    lg: "legs",
    ft: "feet",
    sh: "shoulders",
    gl: "gloves",
    // weapons
    rh: "right hand",
    lh: "left hand",
    // non visible
    hd: "head",
    nk: "neck",
    r1: "ring 1",
    r2: "ring 2",
    // consumables
    bl: "belt",
} as const;

type EquipmentSlot = keyof typeof EQUIPMENT_SLOTS;

const EquipmentSlotsEnum = Object.keys(EQUIPMENT_SLOTS) as [
    EquipmentSlot,
    ...EquipmentSlot[],
]; // for use with zod

const equipmentSlots = new Set<EquipmentSlot>(
    Object.keys(EQUIPMENT_SLOTS) as EquipmentSlot[],
);

const weaponSlots = new Set<EquipmentSlot>(["rh", "lh"]);

const equipmentSlotCapacity: Partial<Record<EquipmentSlot, number>> = {
    // defaults to 1 if not specified
    bl: 5,
};

type NoiseType = "simplex" | "random";

interface AssetMetadata {
    path: string; // eg. bundle/name or url (must start with http)
    animations?: Record<string, string>; // create an animation pointing to an in the sprite.json
    variants?: Record<string, string>; // create a variant pointing to a frame in the sprite.json
    probability?: Record<string, number>; // probability of each variant
    width?: number; // number of horizontal cells at the geohash precision, origin is always top left (default: 1)
    height?: number; // number of vertical cells at the geohash precision, origin is always top left (default: 1)
    precision?: number; // geohash precision (default: unit)
}

interface TileLayer {
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
}

interface ObjectLayer {
    x: number;
    y: number;
    type: "objectgroup";
    name: string;
    objects: {
        point: boolean;
        x: number;
        y: number;
        properties: { name: string; value: any; type: string }[];
    }[];
}

interface WorldAssetMetadata {
    layers: (TileLayer | ObjectLayer)[];
    height: number;
    width: number;
    tilewidth: number;
    tileheight: number;
}

type GridCell = {
    precision: number;
    row: number;
    col: number;
    geohash: string;
};

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

type LocationType =
    | GeohashLocation // environment
    | EquipmentSlot // equiped
    | "inv" // inventory
    | "item" // inside an item
    | "quest"; // quest item waiting to be dropped

const geohashLocationTypes = new Set([
    "geohash",
    "d1",
    "d2",
    "d3",
    "d4",
    "d5",
    "d6",
    "d7",
    "d8",
    "d9",
    "in", // inside building
    "limbo", // npcs created first start in limbo before being placed
]);

const GeohashLocationSchema = z.enum([
    "geohash",
    "d1",
    "d2",
    "d3",
    "d4",
    "d5",
    "d6",
    "d7",
    "d8",
    "d9",
    "in",
    "limbo",
]);
type GeohashLocation = z.infer<typeof GeohashLocationSchema>;
