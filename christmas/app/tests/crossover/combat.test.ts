import { crossoverCmdPerformAbility, stream } from "$lib/crossover";
import {
    abilities,
    checkInRange,
    hasResourcesForAbility,
    patchEffectWithVariables,
} from "$lib/crossover/world/abilities";
import { monsterLUReward } from "$lib/crossover/world/bestiary";
import { sanctuariesByRegion } from "$lib/crossover/world/world";
import {
    entityIsBusy,
    performAbility,
    performEffectOnEntity,
    spawnMonster,
} from "$lib/server/crossover";
import { fetchEntity } from "$lib/server/crossover/redis";
import type {
    Monster,
    MonsterEntity,
    Player,
    PlayerEntity,
} from "$lib/server/crossover/redis/entities";
import { sleep } from "$lib/utils";
import { expect, test } from "vitest";
import type { StreamEvent } from "../../src/routes/api/crossover/stream/+server";
import { getRandomRegion } from "../utils";
import {
    buffEntity,
    collectEventDataForDuration,
    createRandomPlayer,
    generateRandomGeohash,
    waitForEventData,
} from "./utils";

test("Test Combat", async () => {
    const region = String.fromCharCode(...getRandomRegion());
    const sanctuary = sanctuariesByRegion[region];

    // Create players
    const playerOneName = "Gandalf";
    const playerOneGeohash = generateRandomGeohash(6, "h9");
    let [playerOneWallet, playerOneCookies, playerOne] =
        await createRandomPlayer({
            region,
            geohash: playerOneGeohash,
            name: playerOneName,
        });

    // Create streams
    const [playerOneStream, playerOneCloseStream] = await stream({
        Cookie: playerOneCookies,
    });
    await expect(
        waitForEventData(playerOneStream, "feed"),
    ).resolves.toMatchObject({
        type: "system",
        message: "started",
    });

    // Spawn monsters
    let goblin = await spawnMonster({
        geohash: playerOneGeohash,
        beast: "goblin",
        level: 1,
    });

    /*
     * Test gain LUs after killing monster
     */

    // Give player enough mana to cast disintegrate
    playerOne = (await buffEntity(playerOne.player, {
        mp: 2000,
        level: 1000,
    })) as PlayerEntity;

    // Perform ability on target
    let playerBefore = { ...playerOne };
    await testPlayerPerformAbilityOnMonster({
        player: playerOne,
        monster: goblin,
        ability: abilities.disintegrate.ability,
        cookies: playerOneCookies,
        stream: playerOneStream,
    });

    // Check player gained LUs
    playerOne = (await fetchEntity(playerOne.player)) as Player;
    const { lumina, umbra } = monsterLUReward({
        level: goblin.lvl,
        beast: goblin.beast,
    });
    expect(playerOne).toMatchObject({
        player: playerOne.player,
        lum: playerBefore.lum + lumina,
        umb: playerBefore.umb + umbra,
    });

    /*
     * Test player respawn when monster kills player
     */

    // Rest playerOne to level 1
    playerOne = (await buffEntity(playerOne.player, {
        level: 1,
    })) as PlayerEntity;

    // Give monster enough mana to cast disintegrate
    goblin = (await buffEntity(goblin.monster, {
        mp: 2000,
        level: 1000,
    })) as MonsterEntity;

    // Perform ability on target
    playerBefore = { ...playerOne };
    await testMonsterPerformAbilityOnPlayer({
        monster: goblin,
        player: playerOne as PlayerEntity,
        ability: abilities.disintegrate.ability,
        stream: playerOneStream,
    });
});

async function testMonsterPerformAbilityOnPlayer({
    monster,
    player,
    ability,
    stream,
}: {
    monster: MonsterEntity;
    player: PlayerEntity;
    ability: string;
    stream: EventTarget; // player's stream
}) {
    // Assume that monster is able to perform ability (in range, enough resources etc..)
    const { procedures, mp, st, hp } = abilities[ability];
    const playerBefore: PlayerEntity = { ...player };
    const monsterBefore: MonsterEntity = { ...monster };
    const sanctuary = sanctuariesByRegion[player.rgn];

    // Perform ability on player
    await performAbility({
        self: monster,
        target: player, // this will change player in place
        ability,
    });

    let feedEvents: StreamEvent[] = [];
    let entitiesEvents: StreamEvent[] = [];
    let entitiesEventsCnt = 0;
    collectEventDataForDuration(stream, "entities").then((events) => {
        entitiesEvents = events;
    });
    collectEventDataForDuration(stream, "feed").then((events) => {
        feedEvents = events;
    });
    await sleep(500); // wait for events to be collected

    // Check received 'entities' event for procedures effecting target
    for (const [type, effect] of procedures) {
        if (type === "action") {
            const actualEffect = patchEffectWithVariables({
                effect,
                self: monster,
                target: player,
            });
            // Check if effect is applied to self
            if (effect.target === "self") {
                console.log(`Checking effect applied to self`);
            }
            // Check if effect is applied to target
            else {
                console.log(`Checking effect applied to target`);
                expect(entitiesEvents[entitiesEventsCnt]).toMatchObject({
                    players: [
                        await performEffectOnEntity({
                            entity: { ...playerBefore },
                            effect: actualEffect,
                        }),
                    ],
                    monsters: [
                        {
                            monster: monster.monster,
                            mp: monsterBefore.mp - mp,
                            st: monsterBefore.st - st,
                            hp: monsterBefore.hp - hp,
                        },
                    ],
                });
            }
            entitiesEventsCnt += 1;
        }
    }

    if (playerBefore.hp > 0 && player.hp <= 0) {
        console.log("Checking for death feed");
        expect(feedEvents).toMatchObject([
            { event: "feed", type: "message", message: "You died." },
        ]);
        console.log("Checking event for player respawn");
        expect(entitiesEvents[entitiesEventsCnt]).toMatchObject({
            players: [
                {
                    player: player.player,
                    hp: 0,
                    loc: [sanctuary.geohash],
                },
            ],
        });
    }
}

async function testPlayerPerformAbilityOnMonster({
    player,
    monster,
    ability,
    cookies,
    stream,
}: {
    player: Player;
    monster: Monster;
    ability: string;
    cookies: string;
    stream: EventTarget;
}) {
    const { procedures, ap, mp, st, hp, range, predicate } = abilities[ability];
    const playerBefore = { ...player };
    const monsterBefore = { ...monster };
    const inRange = checkInRange(player, monster, range);
    const [isBusy, now] = entityIsBusy(player);
    const { hasResources, message: resourceInsufficientMessage } =
        hasResourcesForAbility(player, ability);

    // Perform ability on monster
    await crossoverCmdPerformAbility(
        {
            target: monster.monster,
            ability,
        },
        { Cookie: cookies },
    );

    // Check received feed event if not enough resources
    if (!hasResources) {
        console.log("Checking feed event for insufficient resources");
        await expect(waitForEventData(stream, "feed")).resolves.toMatchObject({
            type: "message",
            status: "failure",
            message: resourceInsufficientMessage,
        });
    }
    // Check received feed event if target predicate is not met
    else if (
        !predicate.targetSelfAllowed &&
        player.player === monster.monster
    ) {
        console.log("Checking feed event for target predicate not met");
        await expect(waitForEventData(stream, "feed")).resolves.toMatchObject({
            type: "message",
            status: "failure",
            message: `You can't ${ability} yourself`,
        });
    }
    // Check received feed event if out of range
    else if (!inRange) {
        console.log("Checking feed event for out of range");
        await expect(waitForEventData(stream, "feed")).resolves.toMatchObject({
            type: "message",
            status: "failure",
            message: "Target is out of range",
        });
    }
    // Check received feed event if self is busy
    else if (isBusy) {
        console.log("Checking feed event for self is busy");
        await expect(waitForEventData(stream, "feed")).resolves.toMatchObject({
            type: "message",
            status: "failure",
            message: "You are busy at the moment.",
        });
    }
    // Check procedure effects
    else {
        const entitiesEvents = await collectEventDataForDuration(
            stream,
            "entities",
        );
        let entitiesEventsCnt = 0;

        // Check received 'entities' event consuming player resources
        expect(entitiesEvents[entitiesEventsCnt]).toMatchObject({
            players: [
                {
                    player: player.player,
                    mp: playerBefore.mp - mp,
                    st: playerBefore.st - st,
                    hp: playerBefore.hp - hp,
                    // skip ap because it recovers over time and hard to test
                },
            ],
        });
        entitiesEventsCnt += 1;

        // Check received 'entities' event for procedures effecting target
        for (const [type, effect] of procedures) {
            if (type === "action") {
                const actualEffect = patchEffectWithVariables({
                    effect,
                    self: player,
                    target: monster,
                });

                // Check if effect is applied to self
                if (effect.target === "self") {
                    console.log(`Checking effect applied to self`);
                    player = (await performEffectOnEntity({
                        entity: player,
                        effect: actualEffect,
                    })) as Player;
                    expect(entitiesEvents[0]).toMatchObject({
                        players: [self],
                        monsters: [],
                    });
                }
                // Check if effect is applied to target
                else {
                    console.log(
                        `Checking effect applied to monster ${monster.name}`,
                    );
                    monster = (await performEffectOnEntity({
                        entity: monster,
                        effect: actualEffect,
                    })) as Monster;
                    expect(entitiesEvents[entitiesEventsCnt]).toMatchObject({
                        players: [{ player: player.player }],
                        monsters: [monster],
                    });
                }
                entitiesEventsCnt += 1;
            }
        }

        // Check received 'entities' event for monster reward
        if (monsterBefore.hp > 0 && monster.hp <= 0) {
            console.log("Checking event for LUs gain after killing monster");
            const { lumina, umbra } = monsterLUReward({
                level: monster.lvl,
                beast: monster.beast,
            });
            expect(entitiesEvents[entitiesEventsCnt]).toMatchObject({
                players: [
                    {
                        player: player.player,
                        lum: playerBefore.lum + lumina,
                        umb: playerBefore.umb + umbra,
                    },
                ],
            });
        }
    }
}
