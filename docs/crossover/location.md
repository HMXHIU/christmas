# Location System

## Location and Location Type

### Underground

Underground locations are geohash locations with `locationType=d1,d2,d3,...`

### Objects in the world

Note: In redis `location=loc` and `locationType=locT`

Objects which are located in the world:

```ts
{
  "location": ["w21z3wwv"], // array because an object can be in multiple cells
  "locationType": "geohash"
}
```

### Objects in objects

Objects which are located inside other objects such as chests:

```js
{
  "location": [`${item}`],
  "locationType": "item"
}
```

### Objects in player inventory

Objects which are located in the player's inventory will be prefixed with `inv_${player}`

```js
{
  "location": [`${player}`],
  "locationType": "inv"
}
```

### Equiped objects by the player

Objects being equiped by the player:

```js
{
  "location": [`${player}`],
  "locationType": "rh|lh|ft|..."
}
```

This ensure that only 1 item in the slot can be equiped at a time.

**Equipment slots:**

```json
{
  "rh": "right hand",
  "lh": "left hand",
  "ft": "feet",
  "hd": "head",
  "nk": "neck",
  "ch": "chest",
  "lg": "legs",
  "r1": "ring1",
  "r2": "ring2"
}
```

##### Object spanning more than 1 cell

Objects may span more than 1 cell, thus `location` is a `string[]` of geohashes
Such objects should have the origin at center of the top left cell with a `width` and `height` property in the `prop`
During item creation (where the `item` is created from the `prop`), the `location` should be calculated by including all the cells the object spans.

```json
{
  "location": ["9q8y", "9q8z", "9q8x"]
}
```

To search for items which span more than 1 cell:

```js
await itemRepository.search().where("locations").contain("9q8y*").return.all();
```

## Instanced Locations

Instanced locations are required when a player enters:

- Solo dungeon
- Player housing
- A building

Instanced locations have the following:

- `location` is a geohash
- `locationType` is a `GeohashLocationType` (i.e geohash, d1, d2, d3, ...)
- [x] `locationInstance` (`locI` in redis) if `@` refers to the actual game, if not another instance of the game (a replica of the actual world)
- [x] `loc`, `locT`, `locI` determine the location of the player

Instances are parallel worlds

- The house, building, dungeon exist in the actual world `locI="@"` (Note: redis cant search for empty)
- When the player enters an instance:
  - Actual world entities (items, players, monsters) are filtered off and uninteractable
  - Items on player such as equipment are tied to the player instead of the instance
  - World entities persists (worlds and biomes are the same across all parallel worlds)
  - A new set of (items, monsters) neeed to be spawned by the server to prepare the instance
  - The instances are typically temporary (with exceptions such as player housing etc...)
- Use player id as the `locI` for player instances such as solo dungeons
- World template should include metadata for spawn points of items and monsters
- When server creates world instance, it should also spawn the monsters and items in the preparation phase

Entering and exiting instances

- Solo dungeons, player housing, buildings should only have a single exit point to bring the player back to the actual world
- This is to prevent him from exploring outside the instance into the parallel world
- Scripts should not spawn monsters/items into instanced worlds (only during the preparation phase)
- [x] An endpoint to prepare the world should take in a `world` template and spawn the required items/monsters in that template only

Location variable substitute

- [x] Teleport support `locI` variable substitute
- [x] `performEffectOnEntity` support for `locI` change
- [x] When `locI` changes, need to reload world, look, etc ... similar to `locT` change
- [x] Use itemId (eg. tavern) as `locationInstance` when entering
