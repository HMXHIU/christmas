# Problem: Too much entity data

---

When moving or looking (non targetted), the player receives the full entity data from redis. Instead it should only receive the require information to draw the entity on screen. Only provide more information when a player looks at a certain entity

```js
{
    name: "ben",
    loc: [],
    locT: "geohash",

    // Player
    player: "7umC2fKc8zH7s7M4aBDcWCthAJVsq6nyFKr6T7AaQdLZ",

    // Item
    item: "item_woodenclub969",
    prop: "woodendoor",
    state: "open",

    // Monster
    monster: "monster_goblin10609",
    beast: "goblin",
}
```

#### Drawing monsters and items

All the information required can be found in the compendium or bestiary on the client.

#### Drawing players

There should be an GET request endpoint for the player to request equipment data (items:locT = EquipmentSlot). This data can be cached in the client, or the client can draw a generic entity until the equipment data is received.

# Problem: When the entities are out of view, they are culled, but when the player moves back, they are not recreated

---

- [ ] Only send the minimum amount of data for rendering to the client (see above)
- [x] Do not cull entity data from the client unless it is very far away
- [x] As the player moves new data that he does not have should be streamed to him
- [x] Stream entity data from a larger area. To make things simpler just get the 9 neighbours of 6 precision geohash (see `geohashesNearby`)
- [x] When rendering, only render entities that are within the view of the player (separate from the amount of data that the player receives) - use pixijs cullable=true
- [x] Make 6 precision the smallest unit of enitity data that is streamed to the player or that can be requested
- [ ] Entity update events only need to be broadcasted to players within 6p
- [x] When receiving events from entities, client should upsert the entity record data even if they are not in view.
- [x] Client only needs to tween the positions of containers if it is within view, else just set it directly (much less than 6p)

# Problem: Too much movement data

---

When sending movement data:

- [x] The entity should perform the a\* pathfinding to the end position
- [x] The entity should send the full path to the server
- [ ] The server should determine the movement AP cost and reject if the player does not have enough AP
- [ ] The server should check for any collisions and reject if the path is blocked

When receiving movement data:

- [x] The client should tween the entity to the end position following the path
- [x] The client should add additional time to the tween if the entity is moving diagonally

```js
// send
{
    pthclk: 973614596,
    pthdur: 1000,
    pth:['geohash1', 'geohash2', 'geohash3', 'geohash4'],
}

// receive
{
    pthclk: 973614596,
    pthdur: 1000,
    pth:['geohash1', 'geohash2', 'geohash3', 'geohash4'],
}
```

#### Deconflicting location of the entity

- [x] Add `pth`, `pthdur`, `pthclk` to the entity in redis.
- [ ] The backend can immediately set the `geohash` to the destination
- [ ] The client receives the `geohash` of the entity
- [ ] The client receives the `pth`, `pthdur`, `pthclk` of the entity if `pthclk` + `pthdur` > `current_time`
- [ ] Both client and server can determine the location of the entity based on the `pth`, `pthdur`, `pthclk`
