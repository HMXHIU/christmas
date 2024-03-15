# Monster Spawning Task

1. Find all players and their parent geohashes `parentGeohashes`
2. Get all neighbours of the parent geohashes without players in it `neighbourParentGeohases`
3. For each neighbouring parent geohash with no players, use the hostile world seed to spawn monsters `candidateNeighbourParentGeohases`
4. Each town (5 chars geohash precision) should only have a maximum number based on the hostile world seed of monsters present at one time `townMonsterLimit`
5. For each `candidateNeighbourParentGeohases` whose number of monsters is less than `townMonsterLimit`, spawn monsters at random geohashes at (8 chars geohash precision - building level)

### Notes:

- How often this task runs determines the rate of monster respawn

## Future Work

- Consider only spawning if there is a monster base in the town
- Once monster base is destroyed, unless built again it will not spawn monsters
- Monster base and type should also determine the respawn rate
