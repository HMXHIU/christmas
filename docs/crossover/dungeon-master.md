# Dungeon Master

The dungeon master process (see `app/src/lib/server/crossover/dungeonMaster.ts`) runs as in a separate process from the main server. It is responsible for spawning monsters in the world and managing the monster AI.

## Monster Spawning Task

```ts
// See app/src/lib/server/crossover/dungeonMaster.ts
async function spawnMonsters(players: PlayerEntity[]) {}
```

1. Find all players and their parent geohashes `parentGeohashes`
2. Get all neighbours of the parent geohashes without players in it `neighbourParentGeohases`
3. For each neighbouring parent geohash with no players, use the hostile world seed to spawn monsters `candidateNeighbourParentGeohases`
4. Each town (5 chars geohash precision) should only have a maximum number based on the hostile world seed of monsters present at one time `townMonsterLimit`
5. For each `candidateNeighbourParentGeohases` whose number of monsters is less than `townMonsterLimit`, spawn monsters at random geohashes at (8 chars geohash precision - building level)

**Notes**

- How often this task runs determines the rate of monster respawn
- Consider only spawning if there is a monster base in the town
- Once monster base is destroyed, unless built again it will not spawn monsters
- Monster base and type should also determine the respawn rate

## Monster Actions

`performMonsterActions` is responsible for performing monster actions. It is called on an interval. It in turn calls `selectMonsterAbility` to determine the monster's action and the player to perform it on.

```ts
// See app/src/lib/server/crossover/dungeonMaster.ts
async function performMonsterActions(
  players: PlayerEntity[],
  monsters?: MonsterEntity[]
);
function selectMonsterAbility(monster: MonsterEntity, player: PlayerEntity);
```

**Notes**

- Need to also include monster movement as part of `selectMonsterAbility`
- Need to know the environment to know path finding and obstacles
