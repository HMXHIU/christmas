# Worlds

1. Worlds are hand designed levels created using the `tiled` editor _(see tilemap.md)_
2. World instances are create at a location from a tilemap template (tiled json format)
3. Worlds are overlaid over existing biomes
4. The url fo the world acts as the template id, similar to props for items and beast for monsters
5. Pathfinding involves checking the `biome` at location, then checking for overrides to `traversableSpeed` in the layer props for that cell
6. The unit location of a world is a plot (32 grid of cells or full geohashes less than unit precision)

```ts
const WorldEntitySchema = new Schema("World", {
  world: { type: "string" }, // instance id
  url: { type: "string" }, // url to the tiledmap json (template id)
  loc: { type: "string[]" }, // geohashes of plots (whole grids - 32 cells)
  locT: LocationType, // geohash, d1, in
  h: { type: "number" }, // height TODO: remove can be determined from geohash
  w: { type: "number" }, // width TODO: remove can be determined from geohash
  cld: { type: "string[]" }, // colliders TODO: remove this use layer properties
});
```

# Overlaying Worlds Over Location Types

In addition to `geohash` location type (`locT`) which represent the surface `d1, in` are location types which represent underground and inside buildings:

```ts
const geohashLocationTypes = new Set([
  "geohash",
  "d1", // underground
  "d2",
  "d3",
  "d4",
  "d5",
  "d6",
  "d7",
  "d8",
  "d9",
  "in", // inside
]);
```

## Determining traversibility (eg. in underground biomes)

Underground biomes (eg. `locT=d*`) `biomeAtGeohash`, return rocks with `traversableSpeed=0`.
For a world spawned underground, it should have a layer which defines `traversableSpeed>0` to override the biome traversableSpeed.

For a world underground eg. `locT=d1`, the biome will be rocks and thus not traversable. Instead, a layer in the tilemap can be used to overwrite the `traversableSpeed` using the `properties`. When determining traversibility, first determine the biome at the geohash, then for that cell, check all the layers in the template for `traversableSpeed` and overwrite it.

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

# Isolated worlds (see `location.md`)

Isolated worlds are typically `enter`ed into using an item, the item spawns a world separate from the action world (`locI=@`)

Examples of isolated worlds:

- Tutorials
- Player houses
- Interior of houses

## Location Instance (locI)

- `locI` specifies the game instance of the world (actual world is at `locI=@`)
- An item's id can be used as `locI` for instance when entering a tavern (in addition to `locT=in`)
- A player's id can be used for player unique game instances such as tutorials (This way the player can still move around the world via geohashes, but the world is isolated.)

## Spawn POIs for items, monsters & players

In the tiled editor, create an object layer, with POIs with the following format

```json
{
  "name": "pois",
  "objects": [
    // Player Spawn Point
    {
      "point": true,
      "properties": [
        {
          "name": "spawn",
          "type": "string",
          "value": "player"
        }
      ],
      "x": 619.114093959732,
      "y": 1764.77852348993
    },
    // Item
    {
      "point": true,
      "properties": [
        {
          "name": "prop",
          "type": "string",
          "value": "potionofhealth"
        }
      ],
      "x": 619.114093959732,
      "y": 1764.77852348993
    },
    {
      "point": true,
      "properties": [
        {
          "name": "prop",
          "type": "string",
          "value": "woodenclub"
        },
        {
          "name": "etching",
          "type": "string",
          "value": "well used"
        }
      ],
      "x": 619.114093959732,
      "y": 1764.77852348993
    },
    // Item - spawn portal back to the actual world
    {
      "point": true,
      "properties": [
        {
          "name": "prop",
          "type": "string",
          "value": "portal"
        },
        {
          "name": "target",
          "type": "string",
          "value": "{{source.item}}" // source is a special variable to be substituted when spawning worlds
        },
        {
          "name": "description",
          "type": "string",
          "value": "Tavern exit"
        }
      ],
      "x": 619.114093959732,
      "y": 1764.77852348993
    },
    // Monster
    {
      "point": true,
      "properties": [
        {
          "name": "beast",
          "type": "string",
          "value": "goblin"
        },
        {
          "name": "level",
          "type": "int",
          "value": 2
        }
      ],
      "x": 619.114093959732,
      "y": 1764.77852348993
    }
  ],
  "type": "objectgroup",
  "x": 0,
  "y": 0
}
```

- During `enterItem` the world and the entities defined in the POIs are spawned

### Example: Entering tavern

The tavern prop defines a `world` property it includes information of:

- The world tilemap to spawn when the player `enter` the item (set in `variables.url`)
- The location of the player once `enter` the item (`loc`, `locT`, `locI`)
- Inside the tilemap itself, an exit is spawned to let the player exit out of the instance
- `source` is a special variable substitution key for the item/source which spawned the world instance

```json
{
  "tavern": {
    "prop": "tavern",
    "defaultName": "Tavern",
    "asset": {
      "path": "props/gothic",
      "variants": {
        "default": "wood-door-1"
      },
      "width": 2,
      "height": 2
    },
    "defaultState": "default",
    "durability": 100,
    "charges": 0,
    "weight": -1,
    "collider": true,
    "states": {
      "default": {
        "destructible": false,
        "description": "A humble tavern. ${description}",
        "variant": "default"
      }
    },
    // World property
    "world": {
      "locationInstance": "{{self.item}}",
      "locationType": "in",
      "geohash": "{{self.loc[0]}}",
      "world": "{{self.item}}",
      "url": "${url}"
    },
    "utilities": {},
    "variables": {
      "description": {
        "variable": "description",
        "type": "string",
        "value": "A plain wooden door of the tavern greets you."
      },
      "url": {
        "variable": "url", // configure the tilemap asset url for the world to spawn
        "type": "string",
        "value": ""
      }
    }
  }
}
```

```json
// Item - Spawn portal back to the actual world
{
  "point": true,
  "properties": [
    {
      "name": "prop",
      "type": "string",
      "value": "portal"
    },
    {
      "name": "target",
      "type": "string",
      "value": "{{source.item}}" // source is a special variable to be substituted when spawning worlds
    },
    {
      "name": "description",
      "type": "string",
      "value": "Tavern exit"
    }
  ],
  "x": 619.114093959732,
  "y": 1764.77852348993
}
```

### Example: Spawning a 1 time tutorial instance for the player

TODO

- Similar to entering a tavern, but instead of using the item id as the `locI` we can use the player id
- `player` is a special variable substitution key for the player which used the item

```json
{
  "world": {
    "locationInstance": "{{player.player}}",
    "locationType": "in",
    "geohash": "{{self.loc[0]}}",
    "world": "{{player.player}}",
    "url": "${url}"
  }
}
```

- Using the tutorial template, spawn a new world using the player's public key at any geohash location
- Do not save this to S3 long term storage
- Once player is done, delete the world from redis

### Example: loading isolated world from NFT

TODO
