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
