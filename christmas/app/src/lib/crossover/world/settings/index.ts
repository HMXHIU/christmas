import { PUBLIC_ENVIRONMENT } from "$env/static/public";

export { MS_PER_TICK, SERVER_LATENCY, TICKS_PER_TURN, TILE_HEIGHT, TILE_WIDTH };

// Note:
//  - This is different from CELL_WIDTH / CELL_HEIGHT (scaling when rendering to screen)
//  - This is used for converting the tilemap's `tilewidth/height` to grid cells (during spawning)
const TILE_WIDTH = 256;
const TILE_HEIGHT = 128;

const SERVER_LATENCY = 100; // ms
const TICKS_PER_TURN = 4;
const MS_PER_TICK = PUBLIC_ENVIRONMENT === "development" ? 100 : 500;
// const MS_PER_TICK = 500;
