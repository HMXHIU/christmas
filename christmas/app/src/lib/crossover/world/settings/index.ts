import { PUBLIC_ENVIRONMENT } from "$env/static/public";

export {
    LOCATION_INSTANCE,
    MS_PER_TICK,
    MS_PER_TURN,
    SECONDS_PER_TURN,
    TICKS_PER_TURN,
    TILE_HEIGHT,
    TILE_WIDTH,
};

/*
Tile dimensions is different from CELL_WIDTH / CELL_HEIGHT (scaling when rendering to screen)
It is used for converting the tilemap's `tilewidth`, `tileheight` to grid cells (during spawning)
*/
const TILE_WIDTH = 256;
const TILE_HEIGHT = 128;

const TICKS_PER_TURN = 4;
const MS_PER_TICK = PUBLIC_ENVIRONMENT === "development" ? 100 : 500;
const MS_PER_TURN = TICKS_PER_TURN * MS_PER_TICK;
const SECONDS_PER_TURN = MS_PER_TURN / 1000;

const LOCATION_INSTANCE = "@"; // actual world
