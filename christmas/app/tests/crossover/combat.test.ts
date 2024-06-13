import { crossoverCmdPerformAbility, stream } from "$lib/crossover";
import { entityId } from "$lib/crossover/utils";
import {
    abilities,
    checkInRange,
    hasResourcesForAbility,
    patchEffectWithVariables,
} from "$lib/crossover/world/abilities";
import { monsterLUReward } from "$lib/crossover/world/bestiary";
import {
    entityIsBusy,
    performEffectOnEntity,
    spawnMonster,
} from "$lib/server/crossover";
import { fetchEntity } from "$lib/server/crossover/redis";
import type {
    Item,
    Monster,
    Player,
} from "$lib/server/crossover/redis/entities";
import { expect, test } from "vitest";
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
    })) as Player;

    // Perform ability on target
    let playerBefore = { ...playerOne };
    await testPerformAbility({
        self: playerOne,
        target: goblin,
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
});

async function testPerformAbility({
    self,
    target,
    ability,
    cookies,
    stream,
}: {
    self: Player;
    target: Player | Monster | Item;
    ability: string;
    cookies: string;
    stream: EventTarget;
}) {
    const [eid, entityType] = entityId(target);
    const { procedures, ap, mp, st, hp, range, predicate } = abilities[ability];
    const selfBefore = { ...self };
    const targetBefore = { ...target };
    const inRange = checkInRange(self, target, range);
    const [isBusy, now] = entityIsBusy(self);
    const { hasResources, message: resourceInsufficientMessage } =
        hasResourcesForAbility(self, ability);

    // Perform ability on target
    await crossoverCmdPerformAbility(
        {
            target: eid,
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
        entityId(self)[0] === entityId(target)[0]
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
                    player: self.player,
                    mp: selfBefore.mp - mp,
                    st: selfBefore.st - st,
                    hp: selfBefore.hp - hp,
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
                    self,
                    target,
                });

                // Check if effect is applied to self
                if (effect.target === "self") {
                    console.log(`Checking ${effect} applied to self`);
                    self = (await performEffectOnEntity({
                        entity: self,
                        effect: actualEffect,
                    })) as Player;
                    expect(entitiesEvents[0]).toMatchObject({
                        players: [self],
                        monsters: [],
                    });
                }
                // Check if effect is applied to target
                else {
                    if (entityType === "monster") {
                        console.log(
                            `Checking effect applied to monster ${target.name}`,
                        );
                        target = await performEffectOnEntity({
                            entity: target,
                            effect: actualEffect,
                        });
                        expect(entitiesEvents[entitiesEventsCnt]).toMatchObject(
                            {
                                players: [{ player: self.player }],
                                monsters: [target],
                            },
                        );
                    } else if (entityType === "player") {
                        console.log(
                            `Checking effect applied to player ${target.name}`,
                        );
                        target = await performEffectOnEntity({
                            entity: target,
                            effect: actualEffect,
                        });
                        expect(entitiesEvents[entitiesEventsCnt]).toMatchObject(
                            {
                                players: [{ player: self.player }, target],
                            },
                        );
                    }
                }
                entitiesEventsCnt += 1;
            }
        }

        // Check action consequences
        if (entityType === "monster") {
            // Check received 'entities' event for monster reward
            if (
                (targetBefore as Monster).hp > 0 &&
                (target as Monster).hp <= 0
            ) {
                console.log("Checking event for LUs gain after killing target");
                const { lumina, umbra } = monsterLUReward({
                    level: (target as Monster).lvl,
                    beast: (target as Monster).beast,
                });
                expect(entitiesEvents[entitiesEventsCnt]).toMatchObject({
                    players: [
                        {
                            player: self.player,
                            lum: selfBefore.lum + lumina,
                            umb: selfBefore.umb + umbra,
                        },
                    ],
                });
            }
        }
    }
}
