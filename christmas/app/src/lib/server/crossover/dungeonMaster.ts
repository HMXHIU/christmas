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
    type OnProcedure,
} from "$lib/crossover/world/abilities";
import {
    bestiary,
    monsterStats,
    type Beast,
} from "$lib/crossover/world/bestiary";
import { monstersInGeohashQuerySet, spawnMonster } from ".";
import { monsterRepository, playerRepository } from "./redis";
import type { MonsterEntity, PlayerEntity } from "./redis/entities";

export { performMonsterActions, selectMonsterAbility, spawnMonsters };

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

    const { offensive, defensive, neutral, healing } = beast.abilities;

    // Use the highest ap healing ability if monster's hp is less than half
    if (healing.length > 0 && monster.hp < maxHp / 2) {
        const healingAbilities = healing
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
    if (offensive.length > 0) {
        const offensiveAbilities = offensive
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
    if (defensive.length > 0) {
        const defensiveAbilities = defensive
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
    if (neutral.length > 0) {
        const neutralAbilities = neutral
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

const onProcedure: OnProcedure = async ({
    target,
    effect,
}): Promise<PlayerEntity | MonsterEntity> => {
    if (target.player) {
        console.log("onProcedure", target, effect); // TODO: publish to player

        // Save player
        return (await playerRepository.save(
            (target as PlayerEntity).player,
            target as PlayerEntity,
        )) as PlayerEntity;
    } else if (target.monster) {
        console.log("onProcedure", target, effect);

        // Save monster
        return (await monsterRepository.save(
            (target as MonsterEntity).monster,
            target as MonsterEntity,
        )) as MonsterEntity;
    }
    throw new Error("Invalid target, must be player or monster");
};

async function performMonsterActions(
    players: PlayerEntity[],
    monsters?: MonsterEntity[],
) {
    for (const player of players) {
        // Get monsters in player's geohash
        const monstersNearPlayer =
            monsters ||
            ((await monstersInGeohashQuerySet(
                player.geohash,
            ).return.all()) as MonsterEntity[]);

        // Perform monster actions
        for (const monster of monstersNearPlayer) {
            const ability = selectMonsterAbility(monster, player);
            if (ability != null) {
                performAbility(
                    {
                        self: monster,
                        target: player,
                        ability,
                    },
                    onProcedure,
                );
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
