import {
    childrenGeohashes,
    monsterLimitAtGeohash,
    uninhabitedNeighbouringGeohashes,
    worldSeed,
} from "$lib/crossover/world";
import {
    abilities,
    canPerformAbility,
    performAbility,
} from "$lib/crossover/world/abilities";
import {
    bestiary,
    monsterStats,
    type Beast,
} from "$lib/crossover/world/bestiary";
import {
    loggedInPlayersQuerySet,
    monstersInGeohashQuerySet,
    spawnMonster,
} from ".";
import type { MonsterEntity, PlayerEntity } from "./redis/entities";

export { selectMonsterAbility, spawnMonsters, tick };

async function tick() {
    // Get all logged in players
    const players =
        (await loggedInPlayersQuerySet().return.all()) as PlayerEntity[];

    console.log("Spawning monsters ...");
    await spawnMonsters(players);

    console.log("Monster actions ...");
    await performMonsterActions(players);
}

function selectMonsterAbility(
    monster: MonsterEntity,
    player: PlayerEntity, // TODO: add more intelligence based on player stats
): string | null {
    const beast: Beast = bestiary[monster.beast];

    // TODO: cache this using lru-cache
    const { hp: maxHp } = monsterStats({
        level: monster.level,
        beast: monster.beast,
    });

    // Use the highest ap healing ability if monster's hp is less than half
    if (beast.abilities.healing.length > 0 && monster.hp < maxHp / 2) {
        const healingAbilities = beast.abilities.healing
            .sort((a, b) => {
                return abilities[b].ap - abilities[a].ap;
            })
            .filter((ability) => {
                return canPerformAbility(monster, ability);
            });
        if (healingAbilities.length > 0) {
            return healingAbilities[0];
        }
    }

    // Use the highest ap offensive ability
    if (beast.abilities.offensive.length > 0) {
        const offensiveAbilities = beast.abilities.offensive
            .sort((a, b) => {
                return abilities[b].ap - abilities[a].ap;
            })
            .filter((ability) => {
                return canPerformAbility(monster, ability);
            });
        if (offensiveAbilities.length > 0) {
            return offensiveAbilities[0];
        }
    }

    // Use the highest ap defensive ability
    if (beast.abilities.defensive.length > 0) {
        const defensiveAbilities = beast.abilities.defensive
            .sort((a, b) => {
                return abilities[b].ap - abilities[a].ap;
            })
            .filter((ability) => {
                return canPerformAbility(monster, ability);
            });
        if (defensiveAbilities.length > 0) {
            return defensiveAbilities[0];
        }
    }

    // Use the highest ap neutral ability
    if (beast.abilities.neutral.length > 0) {
        const neutralAbilities = beast.abilities.neutral
            .sort((a, b) => {
                return abilities[b].ap - abilities[a].ap;
            })
            .filter((ability) => {
                return canPerformAbility(monster, ability);
            });
        if (neutralAbilities.length > 0) {
            return neutralAbilities[0];
        }
    }

    // Do nothing
    return null;
}

async function performMonsterActions(players: PlayerEntity[]) {
    for (const player of players) {
        // Get monsters in player's geohash
        const monsters = (await monstersInGeohashQuerySet(
            player.geohash,
        ).return.all()) as MonsterEntity[];

        // Perform monster actions
        for (const monster of monsters) {
            const ability = selectMonsterAbility(monster, player);
            if (ability != null) {
                performAbility({
                    self: monster,
                    target: player,
                    ability,
                });
            }
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
