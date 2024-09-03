## Worlds

1. Worlds are hand designed levels created with the tiled editor
2. World instances are create at a location from a template (tiled json format)
3. Worlds are overlaid over existing biomes
4. The url fo the world acts as the template id, similar to props for items and beast for monsters
5. Pathfinding involves checking the `biome` at location, then checking for overrides to `traversableSpeed` in the layer props for that cell
6. The unit location of a world is a plot (32 grid of cells or full geohashes less than unit precision)

```ts
const WorldEntitySchema = new Schema("World", {
  world: { type: "string" }, // instance id
  url: { type: "string" }, // url to the tiledmap json (template id)
  loc: { type: "string[]" }, // geohashes of plots (whole grids - 32 cells)
  locT: LocationType, // TODO: add location type for world (geohash, d1, u1, ....)
  h: { type: "number" }, // height TODO: remove can be determined from geohash
  w: { type: "number" }, // width TODO: remove can be determined from geohash
  cld: { type: "string[]" }, // colliders TODO: remove this use layer properties
});
```

## New Location Types

In addition to `geohash` location type (`locT`) which represent the surface, add new `geohash` location types:

```ts
underground = [`d1`, `d2`, `d3`, `d4`, `d5`, `d6`, `d7`, `d8`, `d9`, `d10`];
aboveground = [`u1`, `u2`, `u3`, `u4`, `u5`, `u6`, `u7`, `u8`, `u9`, `u10`];
```

#### biomeAtGeohash

In `biomeAtGeohash`, return rocks with `traversableSpeed=0` when `locT=d*`

## Determining traversibility

For a world underground eg. locT=d1, the biome will be rocks and thus not traversable. Instead a layer in the template can be used to overwrite the `traversableSpeed` using the `properties`. When determining traversibility, first determine the biome at the geohash, then for that cell, check all the layers in the template for `traversableSpeed` and overwrite it.

For optimisation purposes, the server should cache the function `isWorldTraversable` called from `isGeohashTraversable`.

```ts
function isWorldTraversable(
  template: string,
  worldRow: number,
  worldCol: number
) {
  // This should be cached
}
```

## Isolated worlds

Examples:

- Tutorials
- Player houses
- Interior of houses

In this case the `locT` can be set as a uuid `publicKey` and the `loc` should still be a list of geohash plots. This way the player can still move around the world via geohashes, but the world is isolated.

#### Example: spawning a 1 time tutorial map for player

- Using the tutorial template, spawn a new world using the player's public key at any geohash location
- Do not save this to S3 long term storage
- Once player is done, delete the world from redis

#### Example: entering player housing

#### Example: loading isolated world from NFT

## Tilemaps

The game defines `TILE_WIDTH` and `TILE_HEIGHT`, and `CELL_WIDTH` and `CELL_HEIGHT` separately.

```ts
// settings/index.ts
const TILE_WIDTH = 64;
const TILE_HEIGHT = 32;

// Game/utils.ts
const CELL_WIDTH = 96; // 64, 96, 128
const CELL_HEIGHT = CELL_WIDTH;
```

- `tilemaps` created in the `Tiled Map Editor` format defines the `tilewidth` and `tileheight` which defines the grid size of tile tilemap
- `TILE_WIDTH` and `TILE_HEIGHT` is the units used to convert a `tilemap`'s `tilewidth` and `tileheight` to cells
- `CELL_WIDTH` and `CELL_HEIGHT` affect the actual size of a cell when rendering to the screen, it is independant from `TILE_WIDTH` and `TILE_HEIGHT`
- Ideally, the `tilewidth` and `tileheight` in the tilemap should be equal to `TILE_WIDTH` and `TILE_HEIGHT` as defined in the game. When they are equal, then one cell in the tilemap is 1 cell in the game.

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
                {
                    name: "interior",
                    type: "bool",
                    value: true,
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

#### How tilemaps are converted to screen

1. Determine how many cells should the image take by using `TILE_WIDTH` and `TILE_HEIGHT` with `tilewidth` and `tileheight`
2. Determine the screen dimensions using `CELL_WIDTH` and `CELL_HEIGHT` and the number of cells
3. Scale the image to fill correct screen dimensions

Get the `imageheight` and the `imagewidth` from the `tileset`

```json
// tileset
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

#### Spawn points for items and monsters

In the tiled editor, create an object layer, with POIs with the following format

```ts
// Items
{
  prop: "woodenclub",
  // Variables are flat, because tiled does not support json
  etching: "heavily used."
}
// Monsters
{
  beast: "goblin",
  level: 2
}
```

during `spawnWorld` the server should read the object layer, find the closest geohash and spawn the items and monsters

#### Notes

- Standardize `TILE_WIDTH=tilewidth=128` and `TILE_HEIGHT=tileheight=64`
