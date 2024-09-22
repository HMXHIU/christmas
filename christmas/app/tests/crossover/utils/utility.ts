import { crossoverCmdUseItem } from "$lib/crossover/client";
import type {
    Item,
    ItemEntity,
    MonsterEntity,
    Player,
    PlayerEntity,
} from "$lib/crossover/types";
import { entityInRange, minifiedEntity } from "$lib/crossover/utils";
import { abilities } from "$lib/crossover/world/settings/abilities";
import { compendium } from "$lib/crossover/world/settings/compendium";
import {
    canUseItem,
    entityIsBusy,
    itemVariableValue,
} from "$lib/server/crossover/utils";
import { cloneDeep } from "lodash-es";
import { expect } from "vitest";
import {
    collectEventDataForDuration,
    waitForEventData,
    type PerformAbilityTestResults,
} from ".";
import type { UpdateEntitiesEvent } from "../../../src/routes/api/crossover/stream/+server";

export async function testPlayerUseItemOnPlayer({
    self,
    target,
    item,
    utility,
    selfCookies,
    selfStream,
    targetStream,
}: {
    self: Player;
    target: Player;
    item: Item;
    utility: string;
    selfCookies: string;
    selfStream: EventTarget;
    targetStream: EventTarget;
}): Promise<
    [
        PerformAbilityTestResults,
        {
            self: Player;
            target: Player;
            item: Item;
            selfBefore: Player;
            targetBefore: Player;
            itemBefore: Item;
        },
    ]
> {
    const targetBefore = cloneDeep(target);
    const selfBefore = cloneDeep(self);
    const itemBefore = cloneDeep(item);
    const prop = compendium[item.prop];
    const propUtility = prop.utilities![utility];
    const propAbility = propUtility.ability;

    // Self use item on target
    await crossoverCmdUseItem(
        {
            target: target.player,
            item: item.item,
            utility,
        },
        { Cookie: selfCookies },
    );

    // Check if can use item
    const { canUse, message } = canUseItem(
        self as PlayerEntity,
        item as ItemEntity,
        utility,
    );

    // Check received feed event if can't use item
    if (!canUse) {
        console.log("Checking feed event for can't use item");
        await expect(
            waitForEventData(selfStream, "feed"),
        ).resolves.toMatchObject({
            type: "error",
            message,
        });
        return [
            "itemConditionsNotMet",
            { self, target, item, selfBefore, targetBefore, itemBefore },
        ];
    }

    // Check received item start state event
    if (item.state !== propUtility.state.start) {
        console.log("Checking event for item start state");
        await expect(
            waitForEventData(selfStream, "entities"),
        ).resolves.toMatchObject({
            players: [{ player: self.player }],
            monsters: [],
            items: [
                {
                    item: item.item,
                    state: propUtility.state.start,
                },
            ],
        });
    }

    // Get target if specified in item variables
    if (prop.variables.target) {
        const newTarget = (await itemVariableValue(
            item as ItemEntity,
            "target",
        )) as PlayerEntity | MonsterEntity | ItemEntity;
        if (newTarget.player !== target.player) {
            throw new Error(
                "Test case not implemented for newTarget.player !== target.player",
            );
        }
    }

    // Get self if specified in item variables (can only be `player` or `monster`)
    if (prop.variables.self) {
        const newSelf = (await itemVariableValue(
            item as ItemEntity,
            "self",
        )) as PlayerEntity | MonsterEntity;
        if (newSelf.player !== self.player) {
            throw new Error(
                "Test case not implemented for newSelf.player !== self.player",
            );
        }
    }

    // Check if item has ability
    if (propAbility != null) {
        console.log(`${self.name} performing ${propAbility} on ${target.name}`);

        // Perform ability on target
        const { procedures, range, predicate } = abilities[propAbility];
        const inRange = entityInRange(self, target, range)[0];
        const [isBusy, now] = entityIsBusy(self);

        // Check received feed event if target predicate is not met
        if (!predicate.targetSelfAllowed && self.player === target.player) {
            console.log("Checking feed event for target predicate not met");
            await expect(
                waitForEventData(selfStream, "feed"),
            ).resolves.toMatchObject({
                type: "error",
                message: `You can't ${propAbility} yourself`,
            });
            return [
                "targetPredicateNotMet",
                {
                    self,
                    target,
                    selfBefore,
                    targetBefore,
                    item,
                    itemBefore,
                },
            ];
        }
        // Check received feed event if out of range
        else if (!inRange) {
            console.log("Checking feed event for out of range");
            await expect(
                waitForEventData(selfStream, "feed"),
            ).resolves.toMatchObject({
                type: "error",
                message: "Target is out of range",
            });
            return [
                "outOfRange",
                {
                    self,
                    target,
                    selfBefore,
                    targetBefore,
                    item,
                    itemBefore,
                },
            ];
        }
        // Check received feed event if self is busy
        else if (isBusy) {
            console.log("Checking feed event for self is busy");
            await expect(
                waitForEventData(selfStream, "feed"),
            ).resolves.toMatchObject({
                type: "error",
                message: "You are busy at the moment.",
            });
            return [
                "busy",
                {
                    self,
                    target,
                    selfBefore,
                    targetBefore,
                    item,
                    itemBefore,
                },
            ];
        }
        // Check procedure effects
        else {
            const entitiesEvents = (await collectEventDataForDuration(
                selfStream,
                "entities",
            )) as UpdateEntitiesEvent[];
            let entitiesEventsCnt = 0;

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
                        console.log(`Checking effect applied to self`);
                        self = (await performEffectOnEntity({
                            entity: self,
                            effect: actualEffect,
                        })) as PlayerEntity;
                        expect(entitiesEvents[entitiesEventsCnt]).toMatchObject(
                            {
                                players: [self],
                                monsters: [],
                            },
                        );
                    }
                    // Check if effect is applied to target
                    else {
                        console.log(
                            `Checking effect applied to monster ${target.name}`,
                        );
                        target = (await performEffectOnEntity({
                            entity: target,
                            effect: actualEffect,
                        })) as PlayerEntity;
                        expect(entitiesEvents[entitiesEventsCnt]).toMatchObject(
                            {
                                players: [
                                    { player: self.player },
                                    { player: target.player },
                                ],
                            },
                        );
                    }
                    entitiesEventsCnt += 1;
                }
            }

            // Check received item end state event
            console.log("Checking event for item end state");
            expect(entitiesEvents[entitiesEventsCnt]).toMatchObject({
                items: [
                    {
                        item: item.item,
                        state: propUtility.state.end,
                        chg: itemBefore.chg - propUtility.cost.charges,
                        dur: itemBefore.dur - propUtility.cost.durability,
                    },
                ],
            });

            // Update item
            for (const i of entitiesEvents[entitiesEventsCnt]?.items!) {
                if (i.item === item.item) {
                    item = i as ItemEntity;
                    break;
                }
            }
            return [
                "success",
                {
                    self,
                    target,
                    selfBefore,
                    targetBefore,
                    item,
                    itemBefore,
                },
            ];
        }
    } else {
        return [
            "success",
            { self, target, selfBefore, targetBefore, item, itemBefore },
        ];
    }
}

export async function testPlayerUseItemOnMonster({
    player,
    monster,
    item,
    utility,
    stream,
    cookies,
}: {
    player: Player;
    monster: Monster;
    item: Item;
    utility: string;
    stream: EventTarget;
    cookies: string;
}): Promise<
    [
        PerformAbilityTestResults,
        {
            player: Player;
            monster: Monster;
            item: Item;
            playerBefore: Player;
            monsterBefore: Monster;
            itemBefore: Item;
        },
    ]
> {
    const monsterBefore = { ...monster };
    const playerBefore = { ...player };
    const itemBefore = { ...item };
    const prop = compendium[item.prop];
    const propUtility = prop.utilities![utility];
    const propAbility = propUtility.ability;

    // Self use item on monster
    var error;
    try {
        await crossoverCmdUseItem(
            {
                target: monster.monster,
                item: item.item,
                utility,
            },
            { Cookie: cookies },
        );
    } catch (err: any) {
        error = err.message;
    }

    // Check if can use item
    const { canUse, message } = canUseItem(
        player as PlayerEntity,
        item as ItemEntity,
        utility,
    );

    // Check received feed event if can't use item
    if (!canUse) {
        console.log("Checking feed event for can't use item");
        expect(error).toEqual(message);
        await expect(waitForEventData(stream, "feed")).resolves.toMatchObject({
            type: "error",
            message,
        });
        return [
            "itemConditionsNotMet",
            { player, monster, item, playerBefore, monsterBefore, itemBefore },
        ];
    }

    // Check received item start state event
    if (item.state !== propUtility.state.start) {
        console.log("Checking event for item start state");
        await expect(
            waitForEventData(stream, "entities"),
        ).resolves.toMatchObject({
            players: [{ player: player.player }],
            monsters: [],
            items: [
                {
                    item: item.item,
                    state: propUtility.state.start,
                },
            ],
        });
    }

    // Check if item has ability
    if (propAbility != null) {
        let target: MonsterEntity | PlayerEntity | ItemEntity =
            monster as MonsterEntity;
        let self: MonsterEntity | PlayerEntity = player as PlayerEntity;

        // Get target if specified in item variables
        if (prop.variables.target) {
            target = (await itemVariableValue(item as ItemEntity, "target")) as
                | PlayerEntity
                | MonsterEntity
                | ItemEntity;
        }

        // Get self if specified in item variables (can only be `player` or `monster`)
        if (prop.variables.self) {
            self = (await itemVariableValue(item as ItemEntity, "self")) as
                | PlayerEntity
                | MonsterEntity;
        }
        console.log(
            `${self!.name} performing ${propAbility} on ${target!.name}`,
        );

        let targetBefore = { ...target };
        let selfBefore = { ...self };

        // Perform ability on target
        if (self?.player && target?.monster) {
            const { procedures, range, predicate } = abilities[propAbility];
            const inRange = entityInRange(self, target, range)[0];
            const [isBusy, now] = entityIsBusy(self);

            // Check received feed event if target predicate is not met
            if (
                !predicate.targetSelfAllowed &&
                self.player === target.monster &&
                self.player === player.player
            ) {
                console.log("Checking feed event for target predicate not met");
                await expect(
                    waitForEventData(stream, "feed"),
                ).resolves.toMatchObject({
                    type: "error",
                    message: `You can't ${propAbility} yourself`,
                });
                return [
                    "targetPredicateNotMet",
                    {
                        player,
                        monster,
                        playerBefore,
                        monsterBefore,
                        item,
                        itemBefore,
                    },
                ];
            }
            // Check received feed event if out of range
            else if (!inRange && self.player === player.player) {
                console.log("Checking feed event for out of range");
                await expect(
                    waitForEventData(stream, "feed"),
                ).resolves.toMatchObject({
                    type: "error",
                    message: "Target is out of range",
                });
                return [
                    "outOfRange",
                    {
                        player,
                        monster,
                        playerBefore,
                        monsterBefore,
                        item,
                        itemBefore,
                    },
                ];
            }
            // Check received feed event if self is busy
            else if (isBusy && self.player === player.player) {
                console.log("Checking feed event for self is busy");
                await expect(
                    waitForEventData(stream, "feed"),
                ).resolves.toMatchObject({
                    type: "error",
                    message: "You are busy at the moment.",
                });
                return [
                    "busy",
                    {
                        player,
                        monster,
                        playerBefore,
                        monsterBefore,
                        item,
                        itemBefore,
                    },
                ];
            }
            // Check procedure effects
            else {
                // Even if self != player, the player should still receive the event updates
                const entitiesEvents = (await collectEventDataForDuration(
                    stream,
                    "entities",
                )) as UpdateEntitiesEvent[];
                let entitiesEventsCnt = 0;

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
                            console.log(`Checking effect applied to self`);
                            self = (await performEffectOnEntity({
                                entity: player,
                                effect: actualEffect,
                            })) as PlayerEntity;
                            expect(
                                entitiesEvents[entitiesEventsCnt],
                            ).toMatchObject({
                                players: [self],
                                monsters: [],
                            });
                        }
                        // Check if effect is applied to target
                        else {
                            console.log(
                                `Checking effect applied to monster ${target.name}`,
                            );
                            target = (await performEffectOnEntity({
                                entity: monster,
                                effect: actualEffect,
                            })) as MonsterEntity;
                            expect(
                                entitiesEvents[entitiesEventsCnt],
                            ).toMatchObject({
                                players: [{ player: player.player }],
                                monsters: [
                                    minifiedEntity(target, {
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
                if (
                    target.monster != null &&
                    (targetBefore as Monster).hp > 0 &&
                    (target as Monster).hp <= 0 &&
                    self.player === player.player
                ) {
                    console.log(
                        "Checking event for LUs gain after killing monster",
                    );
                    const { lum, umb } = monsterLUReward(
                        target as MonsterEntity,
                    );
                    expect(entitiesEvents[entitiesEventsCnt]).toMatchObject({
                        players: [
                            {
                                player: self.player,
                                lum: (selfBefore as Player).lum + lum,
                                umb: (selfBefore as Player).umb + umb,
                            },
                        ],
                    });
                    entitiesEventsCnt += 1;

                    // Update self
                    for (const p of entitiesEvents[entitiesEventsCnt]
                        ?.players!) {
                        if (p.player === self.player) {
                            self = p as PlayerEntity;
                            break;
                        }
                    }
                }

                // Check received item end state event
                console.log("Checking event for item end state");
                expect(entitiesEvents[entitiesEventsCnt]).toMatchObject({
                    items: [
                        {
                            item: item.item,
                            state: propUtility.state.end,
                            chg: itemBefore.chg - propUtility.cost.charges,
                            dur: itemBefore.dur - propUtility.cost.durability,
                        },
                    ],
                });

                // Update item
                for (const i of entitiesEvents[entitiesEventsCnt]?.items!) {
                    if (i.item === item.item) {
                        item = i as ItemEntity;
                        break;
                    }
                }

                // Update monster
                if (target.monster == monster.monster) {
                    monster = target as MonsterEntity;
                }
                // Update player
                if (self.player == player.player) {
                    player = self as PlayerEntity;
                }

                return [
                    "success",
                    {
                        player,
                        monster,
                        playerBefore,
                        monsterBefore,
                        item,
                        itemBefore,
                    },
                ];
            }
        } else {
            throw new Error(
                "Test not implemented for this case (self != player && target != monster)",
            );
        }
    } else {
        return [
            "success",
            { player, monster, playerBefore, monsterBefore, item, itemBefore },
        ];
    }
}
