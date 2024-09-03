import { INTERNAL_SERVICE_KEY } from "$env/static/private";
import {
    crossoverCmdConfigureItem,
    crossoverCmdCreateItem,
    crossoverCmdDrop,
    crossoverCmdEquip,
    crossoverCmdPerformAbility,
    crossoverCmdTake,
    crossoverCmdUnequip,
    crossoverCmdUseItem,
    login as loginCrossover,
    signup,
    stream,
} from "$lib/crossover/client";
import { entityInRange, minifiedEntity } from "$lib/crossover/utils";
import {
    hasResourcesForAbility,
    patchEffectWithVariables,
} from "$lib/crossover/world/abilities";
import { monsterLUReward } from "$lib/crossover/world/bestiary";
import { type ItemVariables } from "$lib/crossover/world/compendium";
import { archetypes, type PlayerMetadata } from "$lib/crossover/world/player";
import { MS_PER_TICK } from "$lib/crossover/world/settings";
import { abilities } from "$lib/crossover/world/settings/abilities";
import { compendium } from "$lib/crossover/world/settings/compendium";
import { sanctuaries } from "$lib/crossover/world/settings/world";
import type {
    EquipmentSlot,
    WorldAssetMetadata,
} from "$lib/crossover/world/types";
import {
    performAbility,
    performEffectOnEntity,
} from "$lib/server/crossover/abilities";
import { generateAvatarHash } from "$lib/server/crossover/player";
import type {
    Item,
    ItemEntity,
    Monster,
    MonsterEntity,
    Player,
    PlayerEntity,
} from "$lib/server/crossover/redis/entities";
import {
    canUseItem,
    entityIsBusy,
    itemVariableValue,
} from "$lib/server/crossover/utils";
import { BUCKETS, ObjectStorage } from "$lib/server/objectStorage";
import { generateRandomSeed, sleep } from "$lib/utils";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { uniqBy } from "lodash";
import { cloneDeep } from "lodash-es";
import { expect } from "vitest";
import type {
    ActionEvent,
    StreamEvent,
    UpdateEntitiesEvent,
} from "../../src/routes/api/crossover/stream/+server";
import { createRandomUser, getRandomRegion } from "../utils";

export type PerformAbilityTestResults =
    | "outOfRange"
    | "busy"
    | "insufficientResources"
    | "targetPredicateNotMet"
    | "itemConditionsNotMet"
    | "failure"
    | "success";

const testWorldAsset: WorldAssetMetadata = {
    height: 8,
    width: 4,
    tileheight: 128,
    tilewidth: 256,
    layers: [
        {
            data: [
                0, 0, 0, 0, 94, 94, 94, 0, 85, 85, 85, 0, 85, 85, 85, 0, 85, 85,
                85, 0, 95, 139, 95, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            ],
            height: 8,
            name: "platform",
            type: "tilelayer",
            width: 4,
            x: 0,
            y: 0,
        },
        // collider
        {
            data: [
                0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 74, 74, 0, 0, 74, 74, 0,
                0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            ],
            height: 8,
            name: "floor",
            offsetx: 0,
            offsety: -42.6820872917527,
            properties: [
                {
                    name: "traversableSpeed",
                    type: "float",
                    value: 0,
                },
                {
                    name: "interior",
                    type: "bool",
                    value: true,
                },
            ],
            type: "tilelayer",
            width: 4,
            x: 0,
            y: 0,
        },
        {
            data: [
                0, 0, 0, 0, 0, 0, 0, 0, 0, 218, 218, 0, 220, 0, 0, 0, 220, 0, 0,
                0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            ],
            height: 8,
            name: "wall_ne",
            offsetx: 12.010347376201,
            offsety: -37.1388500411984,
            properties: [
                {
                    name: "interior",
                    type: "bool",
                    value: true,
                },
            ],
            type: "tilelayer",
            width: 4,
            x: 0,
            y: 0,
        },
        {
            name: "pois",
            objects: [
                {
                    point: true,
                    properties: [
                        {
                            name: "poi",
                            type: "string",
                            value: "enter",
                        },
                    ],
                    x: 1844.61744966443,
                    y: 3637.26174496644,
                },
                {
                    point: true,
                    properties: [
                        {
                            name: "poi",
                            type: "string",
                            value: "exit",
                        },
                    ],
                    x: 619.114093959732,
                    y: 1764.77852348993,
                },
                // Player Spawn Point
                {
                    point: true,
                    properties: [
                        {
                            name: "spawn",
                            type: "string",
                            value: "player",
                        },
                    ],
                    x: 619.114093959732,
                    y: 1764.77852348993,
                },
                // Item
                {
                    point: true,
                    properties: [
                        {
                            name: "prop",
                            type: "string",
                            value: "potionofhealth",
                        },
                    ],
                    x: 619.114093959732,
                    y: 1764.77852348993,
                },
                {
                    point: true,
                    properties: [
                        {
                            name: "prop",
                            type: "string",
                            value: "woodenclub",
                        },
                        {
                            name: "etching",
                            type: "string",
                            value: "well used",
                        },
                    ],
                    x: 619.114093959732,
                    y: 1764.77852348993,
                },
                // Monster
                {
                    point: true,
                    properties: [
                        {
                            name: "beast",
                            type: "string",
                            value: "goblin",
                        },
                        {
                            name: "level",
                            type: "int",
                            value: 2,
                        },
                    ],
                    x: 619.114093959732,
                    y: 1764.77852348993,
                },
            ],
            type: "objectgroup",
            x: 0,
            y: 0,
        },
    ],
};

export async function createWorldAsset(): Promise<{
    url: string;
    asset: WorldAssetMetadata;
}> {
    const url = await ObjectStorage.putJSONObject({
        owner: null,
        name: "tilemaps/test_world_asset.json",
        data: testWorldAsset,
        bucket: BUCKETS.tiled,
    });

    return {
        url,
        asset: testWorldAsset,
    };
}

/**
 * Creates a random player with the specified geohash, region, and name.
 * @param geohash The geohash of the player.
 * @param region The region of the player.
 * @param name The name of the player.
 * @returns A promise that resolves to an array containing the NodeWallet and cookies of the player.
 */
export async function createRandomPlayer({
    geohash,
    region,
    name,
}: {
    geohash: string;
    region: string;
    name: string;
}): Promise<[NodeWallet, string, Player]> {
    const [wallet, cookies] = await createRandomUser({ region });

    const playerMetadata: PlayerMetadata = {
        player: wallet.publicKey.toBase58(),
        name,
        description: "",
        avatar: "",
        attributes: archetypes.fighter.attributes,
        demographic: {
            gender: "male",
            race: "human",
            archetype: "fighter",
        },
        appearance: {
            hair: {
                type: "afro",
                color: "ash_blonde",
            },
            eye: {
                type: "almond",
                color: "amber",
            },
            face: "angular",
            body: "athletic",
            skin: "alabaster",
            personality: "adventurous",
            age: "adult",
        },
    };

    const avatarHash = generateAvatarHash({
        demographic: playerMetadata.demographic,
        appearance: playerMetadata.appearance,
        textures: {},
    });

    const avatarFilename = `${avatarHash}-${generateRandomSeed()}.png`;
    playerMetadata.avatar = `https://example.com/avatar/${avatarFilename}`;

    await ObjectStorage.putObject({
        owner: null,
        bucket: "avatar",
        name: avatarFilename,
        data: Buffer.from(""),
    });

    await signup(playerMetadata, { headers: { Cookie: cookies }, wallet });
    const { status, player } = await loginCrossover(
        { geohash, region },
        { Cookie: cookies },
    );

    return [wallet, cookies, player];
}

export async function createGandalfSarumanSauron() {
    const region = String.fromCharCode(...getRandomRegion());
    const geohash = generateRandomGeohash(8, "h9");
    let playerOne: Player;
    let playerTwo: Player;
    let playerThree: Player;
    let playerOneCookies: string;
    let playerTwoCookies: string;
    let playerThreeCookies: string;
    let playerOneStream: EventTarget;
    let playerTwoStream: EventTarget;
    let playerThreeStream: EventTarget;
    let playerOneWallet: NodeWallet;
    let playerTwoWallet: NodeWallet;
    let playerThreeWallet: NodeWallet;

    // Create players
    [playerOneWallet, playerOneCookies, playerOne] = await createRandomPlayer({
        region,
        geohash: geohash,
        name: "Gandalf",
    });
    [playerTwoWallet, playerTwoCookies, playerTwo] = await createRandomPlayer({
        region,
        geohash: geohash,
        name: "Saruman",
    });
    [playerThreeWallet, playerThreeCookies, playerThree] =
        await createRandomPlayer({
            region,
            geohash: geohash,
            name: "Sauron",
        });

    // Create stream
    [playerOneStream] = await stream({
        Cookie: playerOneCookies,
    });
    await expect(
        waitForEventData(playerOneStream, "feed"),
    ).resolves.toMatchObject({
        type: "system",
        message: "started",
    });

    [playerTwoStream] = await stream({
        Cookie: playerTwoCookies,
    });
    await expect(
        waitForEventData(playerTwoStream, "feed"),
    ).resolves.toMatchObject({
        type: "system",
        message: "started",
    });

    [playerThreeStream] = await stream({
        Cookie: playerThreeCookies,
    });
    await expect(
        waitForEventData(playerThreeStream, "feed"),
    ).resolves.toMatchObject({
        type: "system",
        message: "started",
    });

    return {
        region,
        geohash,
        playerOne: playerOne as PlayerEntity,
        playerTwo: playerTwo as PlayerEntity,
        playerThree: playerThree as PlayerEntity,
        playerOneCookies,
        playerTwoCookies,
        playerThreeCookies,
        playerOneStream,
        playerTwoStream,
        playerThreeStream,
        playerOneWallet,
        playerTwoWallet,
        playerThreeWallet,
    };
}

/**
 * Waits for a specific event data to be emitted from an event target.
 * @param eventTarget The event target to listen for events on.
 * @param streamType The type of event to listen for.
 * @param timeout The timeout value in milliseconds (default: 1000).
 * @returns A promise that resolves to the emitted event data.
 */
export function waitForEventData(
    eventTarget: EventTarget,
    type: string,
    timeout = 500, // default timeout 500 ms
): Promise<StreamEvent> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error("Timeout occurred while waiting for event"));
        }, timeout);

        eventTarget.addEventListener(
            type,
            (event: Event) => {
                clearTimeout(timer);
                resolve((event as MessageEvent).data as StreamEvent);
            },
            { once: true },
        );
    });
}

export function collectEventDataForDuration(
    eventTarget: EventTarget,
    type: string,
    duration = 500,
): Promise<StreamEvent[]> {
    return new Promise((resolve, reject) => {
        const events: StreamEvent[] = [];
        const f = (event: Event) => {
            events.push((event as MessageEvent).data as StreamEvent);
        };

        setTimeout(() => {
            eventTarget.removeEventListener(type, f);
            resolve(events);
        }, duration);

        eventTarget.addEventListener(type, (event: Event) => {
            events.push((event as MessageEvent).data as StreamEvent);
        });
    });
}

export async function flushEventChannel(
    eventTarget: EventTarget,
    type: string,
) {
    await collectEventDataForDuration(eventTarget, type, MS_PER_TICK * 2);
}

export function generateRandomGeohash(
    precision: number,
    startsWith?: string,
): string {
    const evenChars = "bcfguvyz89destwx2367kmqr0145hjnp".split("");
    const oddChars = "prxznqwyjmtvhksu57eg46df139c028b".split("");

    let geohash = startsWith || "";
    for (let i = geohash.length; i < precision; i++) {
        if (i % 2 === 0) {
            geohash += evenChars[Math.floor(Math.random() * evenChars.length)];
        } else {
            geohash += oddChars[Math.floor(Math.random() * oddChars.length)];
        }
    }

    return geohash;
}

export async function buffEntity(
    entity: string,
    {
        level,
        hp,
        mp,
        st,
        ap,
        buffs,
        debuffs,
    }: {
        level?: number;
        hp?: number;
        mp?: number;
        st?: number;
        ap?: number;
        buffs?: string[];
        debuffs?: string[];
    },
): Promise<Player | Monster> {
    const { result } = await (
        await fetch("http://localhost:5173/trpc/crossover.world.buffEntity", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${INTERNAL_SERVICE_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                entity,
                level,
                hp,
                mp,
                st,
                ap,
                buffs,
                debuffs,
            }),
        })
    ).json();
    return result.data as Player | Monster;
}

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
    ability: string;
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
    const { procedures, mp, st, hp } = abilities[ability];
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
                            mp: monsterBefore.mp - mp,
                            st: monsterBefore.st - st,
                            hp: monsterBefore.hp - hp,
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
    ability: string;
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
    const { procedures, ap, mp, st, hp, range, predicate } = abilities[ability];
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
                    mp: playerBefore.mp - mp,
                    st: playerBefore.st - st,
                    hp: playerBefore.hp - hp,
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
    ability: string;
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
    const { procedures, ap, mp, st, hp, range, predicate } = abilities[ability];
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
                    mp: selfBefore.mp - mp,
                    st: selfBefore.st - st,
                    hp: selfBefore.hp - hp,
                    // skip ap because it recovers over time and hard to test
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
            const { procedures, ap, mp, st, hp, range, predicate } =
                abilities[propAbility];
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
                    const { lumina, umbra } = monsterLUReward({
                        level: (target as Monster).lvl,
                        beast: (target as Monster).beast,
                    });
                    expect(entitiesEvents[entitiesEventsCnt]).toMatchObject({
                        players: [
                            {
                                player: self.player,
                                lum: (selfBefore as Player).lum + lumina,
                                umb: (selfBefore as Player).umb + umbra,
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
        const { procedures, ap, mp, st, hp, range, predicate } =
            abilities[propAbility];
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

export async function testPlayerUseItem({
    self,
    item,
    utility,
    cookies,
    stream,
}: {
    self: Player;
    item: Item;
    utility: string;
    cookies: string;
    stream: EventTarget;
}): Promise<
    [
        PerformAbilityTestResults,
        {
            self: Player;
            item: Item;
            selfBefore: Player;
            itemBefore: Item;
        },
    ]
> {
    const selfBefore = cloneDeep(self);
    const itemBefore = cloneDeep(item);
    const prop = compendium[item.prop];
    const propUtility = prop.utilities![utility];

    // Self use item on target
    await crossoverCmdUseItem(
        {
            item: item.item,
            utility,
        },
        { Cookie: cookies },
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
        await expect(waitForEventData(stream, "feed")).resolves.toMatchObject({
            type: "error",
            message,
        });
        return ["itemConditionsNotMet", { self, item, selfBefore, itemBefore }];
    }

    let entitiesEvents: UpdateEntitiesEvent[] = [];
    let entitiesEventsCnt = 0;
    collectEventDataForDuration(stream, "entities").then((events) => {
        entitiesEvents = events as UpdateEntitiesEvent[];
    });
    await sleep(500); // wait for events to be collected

    // Check received item start state event
    if (item.state !== propUtility.state.start) {
        console.log("Checking event for item start state");
        await expect(entitiesEvents[entitiesEventsCnt++]).toMatchObject({
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

    // Check ability event
    const propAbility = propUtility.ability;

    // Check perform ability
    if (propAbility) {
        let targetEntity;
        let newSelf: PlayerEntity | MonsterEntity = self as PlayerEntity;

        // Overwrite target if specified in item variables
        if (prop.variables.target) {
            targetEntity = (await itemVariableValue(
                item as ItemEntity,
                "target",
            )) as PlayerEntity | MonsterEntity | ItemEntity;
        }

        // Overwrite self if specified in item variables (can only be `player` or `monster`)
        if (prop.variables.self) {
            newSelf = (await itemVariableValue(item as ItemEntity, "self")) as
                | PlayerEntity
                | MonsterEntity;
        }

        // Consume ability effects (hard to check and listen for events)
        if (targetEntity && self.player === newSelf.player) {
            for (const [type, effect] of abilities[propAbility].procedures) {
                if (type === "action") {
                    // Update self
                    if (entitiesEvents[entitiesEventsCnt].players) {
                        self = {
                            ...self,
                            ...(entitiesEvents[entitiesEventsCnt].players?.find(
                                (p) => p.player === self.player,
                            ) || {}),
                        };
                    }
                    entitiesEventsCnt += 1;
                }
            }
        }
    }

    // Check received item end state event
    console.log("Checking event for item end state");
    await expect(entitiesEvents[entitiesEventsCnt]).toMatchObject({
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
    item = {
        ...item,
        ...(entitiesEvents[entitiesEventsCnt]?.items?.find(
            (i) => i.item === item.item,
        ) || {}),
    };

    return ["success", { self, selfBefore, item, itemBefore }];
}

export async function testPlayerCreateItem({
    self,
    geohash,
    prop,
    cookies,
    stream,
    variables,
}: {
    self: Player;
    geohash: string;
    prop: string;
    variables?: ItemVariables;
    cookies: string;
    stream: EventTarget;
}): Promise<
    [
        PerformAbilityTestResults,
        {
            self: Player;
            item?: Item;
            selfBefore: Player;
        },
    ]
> {
    const selfBefore = cloneDeep(self);

    // Create item
    await crossoverCmdCreateItem(
        {
            geohash,
            prop: prop,
            variables,
            locationType: "geohash",
        },
        { Cookie: cookies },
    );

    const { items } = (await waitForEventData(
        stream,
        "entities",
    )) as UpdateEntitiesEvent;

    if (items == null || items.length !== 1) {
        return ["failure", { self, selfBefore }];
    }

    expect(items[0]).toMatchObject({
        name: compendium[prop].defaultName,
        state: compendium[prop].defaultState,
        loc: [geohash],
        ...(variables && { vars: variables }),
    });
    return ["success", { self, item: items[0], selfBefore }];
}

export async function testPlayerTakeItem({
    self,
    item,
    cookies,
    stream,
}: {
    self: Player;
    item: Item;
    cookies: string;
    stream: EventTarget;
}): Promise<
    [
        PerformAbilityTestResults,
        {
            self: Player;
            item?: Item;
            itemBefore: Item;
            selfBefore: Player;
        },
    ]
> {
    const selfBefore = cloneDeep(self);
    const itemBefore = cloneDeep(item);

    // Take item
    await crossoverCmdTake({ item: item.item }, { Cookie: cookies });

    const { items } = (await waitForEventData(
        stream,
        "entities",
    )) as UpdateEntitiesEvent;

    if (items == null || items.length !== 1) {
        return ["failure", { self, selfBefore, itemBefore }];
    }

    item = items[0];
    const prop = compendium[item.prop];

    expect(item).toMatchObject({
        name: prop.defaultName,
        state: prop.defaultState,
        locT: "inv",
        loc: [self.player],
    });
    return ["success", { self, item, selfBefore, itemBefore }];
}

export async function testPlayerEquipItem({
    self,
    item,
    slot,
    cookies,
    stream,
}: {
    self: Player;
    item: Item;
    slot: EquipmentSlot;
    cookies: string;
    stream: EventTarget;
}): Promise<
    [
        PerformAbilityTestResults,
        {
            self: Player;
            item?: Item;
            itemBefore: Item;
            selfBefore: Player;
        },
    ]
> {
    const selfBefore = cloneDeep(self);
    const itemBefore = cloneDeep(item);

    // Equip item
    await crossoverCmdEquip({ item: item.item, slot }, { Cookie: cookies });

    const { items } = (await waitForEventData(
        stream,
        "entities",
    )) as UpdateEntitiesEvent;

    item = items?.find((i) => item.item === i.item) as Item; // may also receive unequipped items in existing slot

    if (item == null) {
        return ["failure", { self, selfBefore, itemBefore }];
    }

    const prop = compendium[item.prop];
    expect(item).toMatchObject({
        name: prop.defaultName,
        state: prop.defaultState,
        locT: slot,
        loc: [self.player],
    });
    return ["success", { self, item, selfBefore, itemBefore }];
}

export async function testPlayerUnequipItem({
    self,
    item,
    cookies,
    stream,
}: {
    self: Player;
    item: Item;
    cookies: string;
    stream: EventTarget;
}): Promise<
    [
        PerformAbilityTestResults,
        {
            self: Player;
            item?: Item;
            itemBefore: Item;
            selfBefore: Player;
        },
    ]
> {
    const selfBefore = cloneDeep(self);
    const itemBefore = cloneDeep(item);

    // Equip item
    await crossoverCmdUnequip({ item: item.item }, { Cookie: cookies });

    const { items } = (await waitForEventData(
        stream,
        "entities",
    )) as UpdateEntitiesEvent;

    // May also receive unequipped items in existing slot
    item = items?.find((i) => item.item === i.item) as Item;
    if (item == null) {
        return ["failure", { self, selfBefore, itemBefore }];
    }

    const prop = compendium[item.prop];
    expect(item).toMatchObject({
        name: prop.defaultName,
        state: prop.defaultState,
        locT: "inv",
        loc: [self.player],
    });
    return ["success", { self, item, selfBefore, itemBefore }];
}

export async function testPlayerDropItem({
    self,
    item,
    cookies,
    stream,
}: {
    self: Player;
    item: Item;
    cookies: string;
    stream: EventTarget;
}): Promise<
    [
        PerformAbilityTestResults,
        {
            self: Player;
            item?: Item;
            itemBefore: Item;
            selfBefore: Player;
        },
    ]
> {
    const selfBefore = cloneDeep(self);
    const itemBefore = cloneDeep(item);

    // Equip item
    await crossoverCmdDrop({ item: item.item }, { Cookie: cookies });

    const { items } = (await waitForEventData(
        stream,
        "entities",
    )) as UpdateEntitiesEvent;

    // May also receive unequipped items in existing slot
    item = items?.find((i) => item.item === i.item) as Item;
    if (item == null) {
        return ["failure", { self, selfBefore, itemBefore }];
    }

    const prop = compendium[item.prop];
    expect(item).toMatchObject({
        name: prop.defaultName,
        state: prop.defaultState,
        locT: "geohash",
        loc: self.loc,
    });
    return ["success", { self, item, selfBefore, itemBefore }];
}

export async function testPlayerConfigureItem({
    self,
    item,
    cookies,
    stream,
    variables,
}: {
    self: Player;
    item: Item;
    variables: ItemVariables;
    cookies: string;
    stream: EventTarget;
}): Promise<
    [
        PerformAbilityTestResults,
        {
            self: Player;
            selfBefore: Player;
            item: Item;
            itemBefore: Item;
        },
    ]
> {
    const selfBefore = cloneDeep(self);
    const itemBefore = cloneDeep(item);

    // Configure item
    await crossoverCmdConfigureItem(
        {
            item: item.item,
            variables,
        },
        { Cookie: cookies },
    );

    const { items } = (await waitForEventData(
        stream,
        "entities",
    )) as UpdateEntitiesEvent;

    if (items == null || items.length !== 1) {
        return ["failure", { self, selfBefore, item, itemBefore }];
    }

    expect(items[0]).toMatchObject({
        vars: variables,
    });

    return ["success", { self, selfBefore, item: items[0], itemBefore }];
}
