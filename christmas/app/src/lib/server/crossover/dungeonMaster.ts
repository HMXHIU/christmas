import {
    childrenGeohashes,
    monsterLimitAtGeohash,
    uninhabitedNeighbouringGeohashes,
    worldSeed,
} from "$lib/crossover/world";
import { performAbility } from "$lib/crossover/world/abilities";
import { bestiary, type Beast } from "$lib/crossover/world/bestiary";
import {
    loggedInPlayersQuerySet,
    monstersInGeohashQuerySet,
    spawnMonster,
} from ".";
import type { MonsterEntity, PlayerEntity } from "./redis/entities";

export { spawnMonsters, tick };

async function tick() {
    // Get all logged in players
    const players =
        (await loggedInPlayersQuerySet().return.all()) as PlayerEntity[];

    console.log("Spawning monsters ...");
    await spawnMonsters(players);

    console.log("Monster actions ...");
    await performMonsterActions(players);
}

function decideMonsterAbility(
    monster: MonsterEntity,
    player: PlayerEntity,
): string {
    const beast: Beast = bestiary[monster.beast];
    return Object.keys(beast.abilities.offensive)[0];
}

async function performMonsterActions(players: PlayerEntity[]) {
    for (const player of players) {
        // Get monsters in player's geohash
        const monsters = (await monstersInGeohashQuerySet(
            player.geohash,
        ).return.all()) as MonsterEntity[];

        // Perform monster actions
        for (const monster of monsters) {
            performAbility({
                self: monster,
                target: player,
                ability: decideMonsterAbility(monster, player),
            });
        }
    }
}

async function spawnMonsters(players: PlayerEntity[]) {
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
