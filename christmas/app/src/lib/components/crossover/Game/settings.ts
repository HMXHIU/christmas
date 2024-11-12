export {
    CANVAS_HEIGHT,
    CANVAS_WIDTH,
    CELL_HEIGHT,
    CELL_WIDTH,
    ELEVATION_TO_ISO,
    GRID_COLS,
    GRID_MID_COL,
    GRID_MID_ROW,
    HALF_ISO_CELL_HEIGHT,
    HALF_ISO_CELL_WIDTH,
    ISO_CELL_HEIGHT,
    ISO_CELL_WIDTH,
    OVERDRAW_HEIGHT,
    OVERDRAW_WIDTH,
    uiColors,
};

// Note: this are cartesian coordinates (CELL_HEIGHT = CELL_WIDTH;)
const CELL_WIDTH = 96; // 64, 96, 128, 256
const CELL_HEIGHT = CELL_WIDTH;
const ISO_CELL_WIDTH = CELL_WIDTH;
const ISO_CELL_HEIGHT = CELL_HEIGHT / 2;
const HALF_ISO_CELL_WIDTH = ISO_CELL_WIDTH / 2;
const HALF_ISO_CELL_HEIGHT = ISO_CELL_HEIGHT / 2;
const CANVAS_ROWS = 9;
const CANVAS_COLS = 9;
const OVERDRAW_MULTIPLE = 4;
const CANVAS_WIDTH = ISO_CELL_WIDTH * CANVAS_COLS;
const CANVAS_HEIGHT = ISO_CELL_HEIGHT * CANVAS_ROWS;
const OVERDRAW_WIDTH = CANVAS_WIDTH * OVERDRAW_MULTIPLE;
const OVERDRAW_HEIGHT = CANVAS_HEIGHT * OVERDRAW_MULTIPLE;
const GRID_ROWS = CANVAS_ROWS * OVERDRAW_MULTIPLE;
const GRID_COLS = CANVAS_COLS * OVERDRAW_MULTIPLE;
const GRID_MID_ROW = Math.floor(GRID_ROWS / 2);
const GRID_MID_COL = Math.floor(GRID_COLS / 2);

/*
This affects how high each elevation level appears on the display only.
The elevation levels are from 0-255. Each step should be half a tile height,
this is so that increasing elevation towards the screen does not cover fully the tile in front
Though there may be adjacent tiles with more than 1 level in which they will cover

To create the ambience of mountains and the effect of height
    - Decorations such as rocks, boulders
    - Perlin noise to create elevation noise, plateaus
    - Context image for the MUD descriptor
    - Shadows from a fixed direction, always away pointing up (to show the tiles being blocked)
*/
const ELEVATION_TO_ISO = HALF_ISO_CELL_HEIGHT;

// UI colors
const uiColors = {
    health: "rgb(248 113 113)",
    chaos: "rgb(74 222 128)",
    mind: "rgb(96 165 250)",
    lumina: "rgb(250 204 21)",
    umbra: "rgb(88 28 135)",
};
