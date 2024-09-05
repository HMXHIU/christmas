# Tilemaps

- Created using the Tiled map editor (tilemap, tilesets, images)
- Stored in MINIO under `tiled/public`
  ```
    tilemaps/
        mine.json
        tavern.json
    tilesets/
        kenney-farm.json
        kenney-dungeon.json
    images/
        kenney-dungeon/
            stairsCorner_S.png
            ...
        kenney-farm/
            woodWallHoleCross_S.png
            ...
  ```
- The game defines `TILE_WIDTH` and `TILE_HEIGHT`, and `CELL_WIDTH` and `CELL_HEIGHT` separately.

```ts
// settings/index.ts
const TILE_WIDTH = 256;
const TILE_HEIGHT = 128;

// Game/utils.ts
const CELL_WIDTH = 96; // 64, 96, 128
const CELL_HEIGHT = CELL_WIDTH;
```

- `tilemaps` created in the `Tiled Map Editor` format defines the `tilewidth` and `tileheight` which defines the grid size of tile tilemap
- `TILE_WIDTH` and `TILE_HEIGHT` is the units used to convert a `tilemap`'s `tilewidth` and `tileheight` to cells
- `CELL_WIDTH` and `CELL_HEIGHT` affect the actual size of a cell when rendering to the screen, it is independant from `TILE_WIDTH` and `TILE_HEIGHT`
- Ideally, the `tilewidth` and `tileheight` in the tilemap should be equal to `TILE_WIDTH` and `TILE_HEIGHT` as defined in the game. When they are equal, then one cell in the tilemap is 1 cell in the game.
- Standardize `TILE_WIDTH=tilewidth=256` and `TILE_HEIGHT=tileheight=128`

```ts
{
    height: 8,
    width: 4,
    tileheight: 128, // grid size of tilemap
    tilewidth: 256, // grid size of tilemap
    layers: [
        {
            data: [
                0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 74, 74, 0, 0, 74, 74, 0,
                0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            ],
            height: 8,
            name: "floor",
            offsetx: 0,
            offsety: -42.6820872917527,
            properties: [
                {
                    name: "traversableSpeed",
                    type: "float",
                    value: 0,
                },
            ],
            type: "tilelayer",
            width: 4,
            x: 0,
            y: 0,
        },
    ],
}
```

## Converting to screen coordinates (CELL_WIDTH, CELL_HEIGHT)

1. Determine how many cells should the image take by using `TILE_WIDTH` and `TILE_HEIGHT` with `tilewidth` and `tileheight`
2. Determine the screen dimensions using `CELL_WIDTH` and `CELL_HEIGHT` and the number of cells
3. Scale the image to fill correct screen dimensions (Get the `imageheight` and the `imagewidth` from the `tileset`)

```json
// example tileset
{
  "columns": 0,
  "grid": {
    "height": 1,
    "orientation": "isometric",
    "width": 1
  },
  "margin": 0,
  "name": "Houses Exterior",
  "objectalignment": "topleft",
  "spacing": 0,
  "tilecount": 1,
  "tiledversion": "1.10.2",
  "tileheight": 512,
  "tileoffset": {
    "x": -256,
    "y": 0
  },
  "tiles": [
    {
      "id": 3,
      "image": "../images/ComfyUI_temp_iupoc_00063_.png",
      "imageheight": 512,
      "imagewidth": 512
    }
  ],
  "tilewidth": 512,
  "type": "tileset",
  "version": "1.10"
}
```
