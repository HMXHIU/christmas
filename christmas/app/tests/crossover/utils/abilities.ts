import { crossoverCmdPerformAbility } from "$lib/crossover/client";
import type {
    Monster,
    MonsterEntity,
    Player,
    PlayerEntity,
} from "$lib/crossover/types";
import { entityInRange, minifiedEntity } from "$lib/crossover/utils";
import {
    hasResourcesForAbility,
    patchEffectWithVariables,
    type Abilities,
} from "$lib/crossover/world/abilities";
import { monsterLUReward } from "$lib/crossover/world/bestiary";
import { abilities } from "$lib/crossover/world/settings/abilities";
import { sanctuaries } from "$lib/crossover/world/settings/world";
import { performAbility } from "$lib/server/crossover/abilities";
import { entityIsBusy } from "$lib/server/crossover/utils";
import { sleep } from "$lib/utils";
import { uniqBy } from "lodash";
import { expect } from "vitest";
import {
    collectEventDataForDuration,
    waitForEventData,
    type PerformAbilityTestResults,
} from ".";
import type {
    ActionEvent,
    StreamEvent,
    UpdateEntitiesEvent,
} from "../../../src/routes/api/crossover/stream/+server";

// export async function testPerformAbility({
//     attacker,
//     defender,
//     ability,
//     attackerCookies,
//     defenderCookies,
//     attackerStream,
//     defenderStream,
// }: {
//     attacker: Player | Monster;
//     defender: Player | Monster;
//     ability: Abilities;
//     attackerCookies?: string;
//     defenderCookies?: string;
//     attackerStream?: EventTarget;
//     defenderStream?: EventTarget;
// }): Promise<
//     [
//         string,
//         {
//             attacker: Player | Monster;
//             defender: Player | Monster;
//             attackerBefore: Player | Monster;
//             defenderBefore: Player | Monster;
//         },
//     ]
// > {
//     // Check inputs
//     if ("player" in attacker && (!attackerCookies || !attackerStream)) {
//         throw new Error("Provide Cookies/Stream for attacker");
//     }
//     if ("player" in defender && (!defenderCookies || !defenderStream)) {
//         throw new Error("Provide Cookies/Stream for defender");
//     }

//     // Save original state for testing
//     const attackerBefore = clone(attacker);
//     const defenderBefore = clone(defender);
//     const [defenderId, defenderType] = getEntityId(defender);
//     const [attackerId, attackerType] = getEntityId(attacker);

//     const { procedures, cost, range, predicate } = abilities[ability];
//     // Determine in range
//     const inRange = entityInRange(attacker, defender, range)[0];
//     // Determine is busy
//     const [isBusy, now] = entityIsBusy(attacker);
//     // Determine has resource
//     const { hasResources, message: resourceInsufficientMessage } =
//         hasResourcesForAbility(attacker, ability);

//     // Perform ability
//     if ("player" in attacker) {
//         crossoverCmdPerformAbility(
//             { target: defenderId, ability },
//             { Cookie: attackerCookies },
//         );
//     } else {
//         performMonsterAbility(attacker.monster, defenderId, ability);
//     }

//     // Collect events
//     let attackerEvs;
//     let defenderEvs;
//     if (attackerStream) {
//         collectAllEventDataForDuration(attackerStream).then(
//             (evs) => (attackerEvs = evs),
//         );
//     }
//     if (defenderStream) {
//         collectAllEventDataForDuration(defenderStream).then(
//             (evs) => (defenderEvs = evs),
//         );
//     }
//     await sleep(MS_PER_TICK * 8);

//     // Fetch new entities
//     attacker = (await fetchEntity(attackerId)) as PlayerEntity | MonsterEntity;
//     defender = (await fetchEntity(defenderId)) as PlayerEntity | MonsterEntity;

//     // Check received feed event if conditions not met
//     if (attackerStream) {
//         if (!hasResources) {
//             console.log("Checking feed event for insufficient resources");
//             expect(attackerEvs!.feed[0]).toMatchObject({
//                 type: "error",
//                 message: resourceInsufficientMessage,
//             });
//             return [
//                 resourceInsufficientMessage,
//                 { attacker, defender, attackerBefore, defenderBefore },
//             ];
//         }
//         // Check received feed event if target predicate is not met
//         else if (!predicate.targetSelfAllowed && attackerId === defenderId) {
//             console.log("Checking feed event for target predicate not met");
//             await expect(attackerEvs!.feed[0]).toMatchObject({
//                 type: "error",
//                 message: `You can't ${ability} yourself`,
//             });
//             return [
//                 `You can't ${ability} yourself`,
//                 { attacker, defender, attackerBefore, defenderBefore },
//             ];
//         }
//         // Check received feed event if out of range
//         else if (!inRange) {
//             console.log("Checking feed event for out of range");
//             expect(attackerEvs!.feed[0]).toMatchObject({
//                 type: "error",
//                 message: `${defender.name} is out of range`,
//             });
//             return [
//                 `${defender.name} is out of range`,
//                 { attacker, defender, attackerBefore, defenderBefore },
//             ];
//         }
//         // Check received feed event if self is busy
//         else if (isBusy) {
//             console.log("Checking feed event for self is busy");
//             expect(attackerEvs!.feed[0]).toMatchObject({
//                 type: "error",
//                 message: "You are busy at the moment.",
//             });
//             return [
//                 "You are busy at the moment.",
//                 { attacker, defender, attackerBefore, defenderBefore },
//             ];
//         }
//     }

//     let attackerEntitiesEventsCnt = 0;
//     let defenderEntitiesEventsCnt = 0;

//     // Check received action event
//     if (attackerStream) {
//         expect(attackerEvs!.action[0]).toMatchObject({
//             ability,
//             source: attackerId,
//             target: defenderId,
//             event: "action",
//         });

//         // Check received 'entities' event consuming player resources
//         expect(
//             attackerEvs!.entities[attackerEntitiesEventsCnt++],
//         ).toMatchObject({
//             players: [
//                 {
//                     player: attackerId,
//                     cha: attackerBefore.cha - (cost.cha ?? 0),
//                     mnd: attackerBefore.mnd - (cost.mnd ?? 0),
//                     hp: attackerBefore.hp - (cost.hp ?? 0),
//                     lum: attackerBefore.lum - (cost.lum ?? 0),
//                     umb: attackerBefore.umb - (cost.umb ?? 0),
//                 },
//             ],
//         });
//     }
//     if (defenderStream) {
//         expect(defenderEvs!.action[0]).toMatchObject({
//             ability,
//             source: attackerId,
//             target: defenderId,
//             event: "action",
//         });
//     }

//     // Check received 'entities' event for procedure effects
//     for (const [type, effect] of procedures) {
//         if (type === "action") {
//             const actualEffect = patchEffectWithVariables({
//                 effect,
//                 self: attacker,
//                 target: defender,
//             });

//             // Effect applied to self
//             if (effect.target === "self") {
//                 console.log(`Checking effect applied to self`);

//                 const {} = resolveProcedureEffect(
//                     attacker as PlayerEntity | MonsterEntity,
//                     defender as PlayerEntity | MonsterEntity,
//                     actualEffect,
//                 );

//                 self = (await performEffectOnEntity({
//                     entity: self,
//                     effect: actualEffect,
//                 })) as Player;

//                 const ev = {
//                     players: uniqBy(
//                         [self, target].map((e) =>
//                             minifiedEntity(e, {
//                                 stats: true,
//                                 location: true,
//                             }),
//                         ),
//                         "player",
//                     ),
//                 };
//                 expect(
//                     attackerEvs!.entities[attackerEntitiesEventsCnt++],
//                 ).toMatchObject(ev);
//                 expect(
//                     defenderEvs!.entities[defenderEntitiesEventsCnt++],
//                 ).toMatchObject(ev);
//             }
//             // Effect applied to target
//             else {
//                 console.log(`Checking effect applied to target ${target.name}`);
//                 target = (await performEffectOnEntity({
//                     entity: target,
//                     effect: actualEffect,
//                 })) as Player;
//                 const ev = {
//                     players: [
//                         { player: self.player },
//                         { player: target.player },
//                     ],
//                 };
//                 expect(
//                     attackerEvs!.entities[attackerEntitiesEventsCnt++],
//                 ).toMatchObject(ev);
//                 expect(
//                     defenderEvs!.entities[defenderEntitiesEventsCnt++],
//                 ).toMatchObject(ev);
//             }
//         }
//     }

//     return ["success", { attacker, defender, attackerBefore, defenderBefore }];
// }

/**
 * Tests the ability of a monster to perform an ability on a player.
 *
 * @param monster - The monster entity performing the ability.
 * @param player - The player entity on which the ability is performed.
 * @param ability - The ability being performed.
 * @param stream - The event stream for the player.
 */
export async function testMonsterPerformAbilityOnPlayer({
    monster,
    player,
    ability,
    stream,
}: {
    monster: MonsterEntity;
    player: PlayerEntity;
    ability: Abilities;
    stream: EventTarget; // player's stream
}): Promise<
    [
        PerformAbilityTestResults,
        {
            player: Player;
            monster: Monster;
            playerBefore: Player;
            monsterBefore: Monster;
        },
    ]
> {
    // Assume that monster is able to perform ability (in range, enough resources etc..)
    const { procedures, cost } = abilities[ability];
    const playerBefore: PlayerEntity = { ...player };
    const monsterBefore: MonsterEntity = { ...monster };
    const sanctuary = sanctuaries.find((s) => s.region === player.rgn);

    let feedEvents: StreamEvent[] = [];
    let entitiesEvents: UpdateEntitiesEvent[] = [];
    let entitiesEventsCnt = 0;
    collectEventDataForDuration(stream, "entities").then((events) => {
        entitiesEvents = events as UpdateEntitiesEvent[];
    });
    collectEventDataForDuration(stream, "feed").then((events) => {
        feedEvents = events;
    });

    // Perform ability on player
    await performAbility({
        self: monster,
        target: player.player, // this will change player in place
        ability,
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
                        minifiedEntity(
                            await performEffectOnEntity({
                                entity: { ...playerBefore },
                                effect: actualEffect,
                            }),
                            { location: true, stats: true, timers: true },
                        ),
                    ],
                    monsters: [
                        {
                            monster: monster.monster,
                            cha: monsterBefore.cha - (cost.cha ?? 0),
                            mnd: monsterBefore.mnd - (cost.mnd ?? 0),
                            hp: monsterBefore.hp - (cost.hp ?? 0),
                            lum: monsterBefore.lum - (cost.lum ?? 0),
                            umb: monsterBefore.umb - (cost.umb ?? 0),
                        },
                    ],
                });

                // Update player
                for (const p of entitiesEvents[entitiesEventsCnt].players!) {
                    if (p.player === player.player) {
                        player = p as PlayerEntity;
                        break;
                    }
                }
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
                    loc: [sanctuary!.geohash], // respawn at region's sanctuary with full
                },
            ],
        });

        // Update player
        for (const p of entitiesEvents[entitiesEventsCnt].players!) {
            if (p.player === player.player) {
                player = p as PlayerEntity;
                break;
            }
        }
    }

    return ["success", { player, monster, playerBefore, monsterBefore }];
}

/**
 * Performs an ability on a monster and checks the expected results.
 *
 * @param player - The player performing the ability.
 * @param monster - The monster on which the ability is performed.
 * @param ability - The ability to perform.
 * @param cookies - The cookies for authentication.
 * @param stream - The event stream to listen for events.
 */
export async function testPlayerPerformAbilityOnMonster({
    player,
    monster,
    ability,
    cookies,
    stream,
}: {
    player: Player;
    monster: Monster;
    ability: Abilities;
    cookies: string;
    stream: EventTarget;
}): Promise<
    [
        PerformAbilityTestResults,
        {
            player: Player;
            monster: Monster;
            playerBefore: Player;
            monsterBefore: Monster;
        },
    ]
> {
    const { procedures, cost, range, predicate } = abilities[ability];
    const playerBefore = { ...player };
    const monsterBefore = { ...monster };
    const inRange = entityInRange(player, monster, range)[0];
    const [isBusy, now] = entityIsBusy(player);
    const { hasResources, message: resourceInsufficientMessage } =
        hasResourcesForAbility(player, ability);

    const entitiesEvents = (await collectEventDataForDuration(
        stream,
        "entities",
    )) as UpdateEntitiesEvent[];
    let entitiesEventsCnt = 0;

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
            type: "error",
            message: resourceInsufficientMessage,
        });

        return [
            "insufficientResources",
            { player, monster, playerBefore, monsterBefore },
        ];
    }
    // Check received feed event if target predicate is not met
    else if (
        !predicate.targetSelfAllowed &&
        player.player === monster.monster
    ) {
        console.log("Checking feed event for target predicate not met");
        await expect(waitForEventData(stream, "feed")).resolves.toMatchObject({
            type: "error",
            message: `You can't ${ability} yourself`,
        });
        return [
            "targetPredicateNotMet",
            { player, monster, playerBefore, monsterBefore },
        ];
    }
    // Check received feed event if out of range
    else if (!inRange) {
        console.log("Checking feed event for out of range");
        await expect(waitForEventData(stream, "feed")).resolves.toMatchObject({
            type: "error",
            message: "Target is out of range",
        });
        return ["outOfRange", { player, monster, playerBefore, monsterBefore }];
    }
    // Check received feed event if self is busy
    else if (isBusy) {
        console.log("Checking feed event for self is busy");
        await expect(waitForEventData(stream, "feed")).resolves.toMatchObject({
            type: "error",
            message: "You are busy at the moment.",
        });
        return ["busy", { player, monster, playerBefore, monsterBefore }];
    }
    // Check procedure effects
    else {
        await sleep(500); // wait for entity events to be collected

        // Check received 'entities' event consuming player resources
        expect(entitiesEvents[entitiesEventsCnt]).toMatchObject({
            players: [
                {
                    player: player.player,
                    cha: playerBefore.cha - (cost.cha ?? 0),
                    mnd: playerBefore.mnd - (cost.mnd ?? 0),
                    hp: playerBefore.hp - (cost.hp ?? 0),
                    // skip ap because it recovers over time and hard to test
                },
            ],
        });
        entitiesEventsCnt += 1;

        // Update player
        for (const p of entitiesEvents[entitiesEventsCnt]?.players!) {
            if (p.player === player.player) {
                player = p;
                break;
            }
        }

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

                    expect(entitiesEvents[entitiesEventsCnt]).toMatchObject({
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
                        monsters: [
                            minifiedEntity(monster, {
                                location: true,
                                stats: true,
                                timers: true,
                            }),
                        ],
                    });
                }
                entitiesEventsCnt += 1;
            }
        }

        // Check received 'entities' event for monster reward
        if (monsterBefore.hp > 0 && monster.hp <= 0) {
            console.log("Checking event for LUs gain after killing monster");
            const { lum, umb } = monsterLUReward(monster);
            expect(entitiesEvents[entitiesEventsCnt]).toMatchObject({
                players: [
                    {
                        player: player.player,
                        lum: playerBefore.lum + lum,
                        umb: playerBefore.umb + umb,
                    },
                ],
            });

            // Update player
            for (const p of entitiesEvents[entitiesEventsCnt]?.players!) {
                if (p.player === player.player) {
                    player = p;
                    break;
                }
            }
        }

        return ["success", { player, monster, playerBefore, monsterBefore }];
    }
}

export async function testPlayerPerformAbilityOnPlayer({
    self,
    target,
    ability,
    selfCookies,
    selfStream,
    targetStream,
}: {
    self: Player;
    target: Player;
    ability: Abilities;
    selfCookies: string;
    selfStream: EventTarget;
    targetStream: EventTarget;
}): Promise<
    [
        PerformAbilityTestResults,
        {
            self: Player;
            target: Player;
            selfBefore: Player;
            targetBefore: Player;
        },
    ]
> {
    const { procedures, cost, range, predicate } = abilities[ability];
    const selfBefore = { ...self };
    const targetBefore = { ...target };
    const inRange = entityInRange(self, target, range)[0];
    const [isBusy, now] = entityIsBusy(self);
    const { hasResources, message: resourceInsufficientMessage } =
        hasResourcesForAbility(self, ability);

    // Self events
    let feedEvents: StreamEvent[] = [];
    let entitiesEvents: UpdateEntitiesEvent[] = [];
    let actionEvents: ActionEvent[] = [];
    let entitiesEventsCnt = 0;
    collectEventDataForDuration(selfStream, "entities").then((events) => {
        entitiesEvents = events as UpdateEntitiesEvent[];
    });
    collectEventDataForDuration(selfStream, "feed").then((events) => {
        feedEvents = events;
    });
    collectEventDataForDuration(selfStream, "action").then((events) => {
        actionEvents = events as ActionEvent[];
    });

    // Target events
    let targetFeedEvents: StreamEvent[] = [];
    let targetEntitiesEvents: UpdateEntitiesEvent[] = [];
    let targetActionEvents: ActionEvent[] = [];
    let targetEntitiesEventsCnt = 0;
    collectEventDataForDuration(targetStream, "entities").then((events) => {
        targetEntitiesEvents = events as UpdateEntitiesEvent[];
    });
    collectEventDataForDuration(targetStream, "feed").then((events) => {
        targetFeedEvents = events;
    });
    collectEventDataForDuration(targetStream, "action").then((events) => {
        targetActionEvents = events as ActionEvent[];
    });

    // Perform ability on target
    await crossoverCmdPerformAbility(
        {
            target: target.player,
            ability,
        },
        { Cookie: selfCookies },
    );

    await sleep(500); // wait for events to be collected

    // Check received feed event if not enough resources
    if (!hasResources) {
        console.log("Checking feed event for insufficient resources");
        expect(feedEvents[0]).toMatchObject({
            type: "error",
            message: resourceInsufficientMessage,
        });
        return [
            "insufficientResources",
            { self, target, selfBefore, targetBefore },
        ];
    }
    // Check received feed event if target predicate is not met
    else if (!predicate.targetSelfAllowed && self.player === target.player) {
        console.log("Checking feed event for target predicate not met");
        await expect(feedEvents[0]).toMatchObject({
            type: "error",
            message: `You can't ${ability} yourself`,
        });
        return [
            "targetPredicateNotMet",
            { self, target, selfBefore, targetBefore },
        ];
    }
    // Check received feed event if out of range
    else if (!inRange) {
        console.log("Checking feed event for out of range");
        expect(feedEvents[0]).toMatchObject({
            type: "error",
            message: "Target is out of range",
        });
        return ["outOfRange", { self, target, selfBefore, targetBefore }];
    }
    // Check received feed event if self is busy
    else if (isBusy) {
        console.log("Checking feed event for self is busy");
        expect(feedEvents[0]).toMatchObject({
            type: "error",
            message: "You are busy at the moment.",
        });
        return ["busy", { self, target, selfBefore, targetBefore }];
    } else {
        // Check received action event
        expect(actionEvents[0]).toMatchObject({
            ability,
            source: self.player,
            target: target.player,
            event: "action",
        });
        expect(targetActionEvents[0]).toMatchObject({
            ability,
            source: self.player,
            target: target.player,
            event: "action",
        });

        // Check received 'entities' event consuming player resources
        expect(entitiesEvents[entitiesEventsCnt]).toMatchObject({
            players: [
                {
                    player: self.player,
                    cha: selfBefore.cha - (cost.cha ?? 0),
                    mnd: selfBefore.mnd - (cost.mnd ?? 0),
                    hp: selfBefore.hp - (cost.hp ?? 0),
                    lum: selfBefore.lum - (cost.lum ?? 0),
                    umb: selfBefore.umb - (cost.umb ?? 0),
                },
            ],
        });
        entitiesEventsCnt += 1;

        // Update self
        self = {
            ...self,
            ...(entitiesEvents[entitiesEventsCnt]?.players?.find(
                (p) => p.player === self.player,
            ) || {}),
        };

        // Check received 'entities' event for procedures effecting target
        for (const [type, effect] of procedures) {
            if (type === "action") {
                const actualEffect = patchEffectWithVariables({
                    effect,
                    self,
                    target,
                });

                // Effect applied to self
                if (effect.target === "self") {
                    console.log(`Checking effect applied to self`);
                    self = (await performEffectOnEntity({
                        entity: self,
                        effect: actualEffect,
                    })) as Player;
                    const ev = {
                        players: uniqBy(
                            [self, target].map((e) =>
                                minifiedEntity(e, {
                                    stats: true,
                                    location: true,
                                }),
                            ),
                            "player",
                        ),
                    };
                    expect(entitiesEvents[entitiesEventsCnt]).toMatchObject(ev);
                    expect(
                        targetEntitiesEvents[targetEntitiesEventsCnt],
                    ).toMatchObject(ev);
                }
                // Effect applied to target
                else {
                    console.log(
                        `Checking effect applied to target ${target.name}`,
                    );
                    target = (await performEffectOnEntity({
                        entity: target,
                        effect: actualEffect,
                    })) as Player;
                    const ev = {
                        players: [
                            { player: self.player },
                            { player: target.player },
                        ],
                    };
                    expect(entitiesEvents[entitiesEventsCnt]).toMatchObject(ev);
                    expect(
                        targetEntitiesEvents[targetEntitiesEventsCnt],
                    ).toMatchObject(ev);
                }
                entitiesEventsCnt += 1;
                targetEntitiesEventsCnt += 1;
            }
        }
        return ["success", { self, target, selfBefore, targetBefore }];
    }
}
