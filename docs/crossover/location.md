# Location System

## Location string

### Objects in the world

Objects which are located in the world:

```js
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

## Object spanning more than 1 cell

Objects which span more than 1 cell should have location as a `string[]`
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
