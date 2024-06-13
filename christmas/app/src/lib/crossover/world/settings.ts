import { PUBLIC_ENVIRONMENT } from "$env/static/public";
import type { Tile } from "./types";
export { MS_PER_TICK, TICKS_PER_TURN, TILE_HEIGHT, TILE_WIDTH, abyssTile };

const abyssTile: Tile = {
    name: "The Abyss",
    geohash: "59ke577h",
    description: "You are nowhere to be found.",
};

const TILE_WIDTH = 64;
const TILE_HEIGHT = 32;

const TICKS_PER_TURN = 4;
const MS_PER_TICK = PUBLIC_ENVIRONMENT === "development" ? 1 : 2000;
// const MS_PER_TICK = 2000;
