import {
    childrenGeohashes,
    monsterLimitAtGeohash,
    uninhabitedNeighbouringGeohashes,
    worldSeed,
} from "$lib/crossover/world";
import { bestiary } from "$lib/crossover/world/bestiary";
import {
    loggedInPlayersQuerySet,
    monstersInGeohashQuerySet,
    spawnMonster,
} from ".";
import type { PlayerEntity } from "./redis/entities";

export { spawnMonsters, tick };

async function tick() {
    console.log("Spawning monsters ...");
    await spawnMonsters();
}

async function spawnMonsters() {
    // Get all logged in players
    const players =
        (await loggedInPlayersQuerySet().return.all()) as PlayerEntity[];

    // Get all parent geohashes (only interested with geohashes 1 level above unit precision)
    const parentGeohashes = players
        .map(({ geohash }) => {
            return geohash.slice(0, -1);
        })
        .filter(
            (geohash) =>
                geohash.length === worldSeed.spatial.unit.precision - 1,
        );

    // Get all neighboring geohashes where there are no players
    const uninhabitedGeohashes =
        await uninhabitedNeighbouringGeohashes(parentGeohashes);

    for (const geohash of uninhabitedGeohashes) {
        // Get monster limit for each uninhabited geohash
        const monsterLimit = await monsterLimitAtGeohash(geohash);

        // Get number of monsters in geohash
        const numMonsters = await monstersInGeohashQuerySet(geohash).count();

        // Number of monsters to spawn
        const numMonstersToSpawn = monsterLimit - numMonsters;

        if (numMonstersToSpawn <= 0) {
            continue;
        }

        // Select a random set of child geo hashes to spawn monsters
        const childGeohashes = childrenGeohashes(geohash).sort(
            () => Math.random() - 0.5,
        );

        // Spawn monsters
        for (let i = 0; i < numMonstersToSpawn; i++) {
            // Get a random child geohash
            const childGeohash = childGeohashes[i % childGeohashes.length];

            const monster = await spawnMonster({
                geohash: childGeohash,
                beast: bestiary.goblin.beast, // TODO: use PG to get random beast
            });
        }
    }
}
