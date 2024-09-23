import { crossoverCmdPerformAbility } from "$lib/crossover/client";
import type { PlayerEntity } from "$lib/crossover/types";
import { minifiedEntity } from "$lib/crossover/utils";
import { patchEffectWithVariables } from "$lib/crossover/world/abilities";
import { awardKillCurrency } from "$lib/crossover/world/entity";
import { MS_PER_TICK } from "$lib/crossover/world/settings";
import { abilities } from "$lib/crossover/world/settings/abilities";
import { worldSeed } from "$lib/crossover/world/settings/world";
import { consumeResources } from "$lib/server/crossover";
import { respawnPlayer } from "$lib/server/crossover/combat/utils";
import { initializeClients } from "$lib/server/crossover/redis";
import { saveEntity } from "$lib/server/crossover/redis/utils";
import { sleep } from "$lib/utils";
import { beforeEach, describe, expect, test } from "vitest";
import {
    collectAllEventDataForDuration,
    createGandalfSarumanSauron,
    generateRandomGeohash,
    resetEntityResources,
} from "./utils";

await initializeClients(); // create redis repositories

let {
    geohash,
    playerOne,
    playerOneCookies,
    playerTwoStream,
    playerOneStream,
    playerTwo,
} = await createGandalfSarumanSauron();

beforeEach(async () => {
    playerOne.loc = [geohash];
    playerTwo.loc = [geohash];
    resetEntityResources(playerOne, playerTwo);
});

describe("Abilities Tests", () => {
    test("Ability out of range", async () => {
        // Move `playerTwo` out of range
        playerTwo.loc = [
            generateRandomGeohash(worldSeed.spatial.unit.precision, "h9"),
        ];
        playerTwo = await saveEntity(playerTwo);

        crossoverCmdPerformAbility(
            { target: playerTwo.player, ability: abilities.bruise.ability },
            { Cookie: playerOneCookies },
        );
        expect(
            await collectAllEventDataForDuration(playerOneStream),
        ).toMatchObject({
            feed: [
                {
                    type: "error",
                    message: "Saruman is out of range",
                    event: "feed",
                },
            ],
            entities: [],
            cta: [],
            action: [],
        });
    });

    test("Not enough resources", async () => {
        playerOne.mnd = 0;
        playerOne.cha = 0;
        playerOne = await saveEntity(playerOne);

        crossoverCmdPerformAbility(
            { target: playerTwo.player, ability: abilities.bruise.ability },
            { Cookie: playerOneCookies },
        );
        expect(
            await collectAllEventDataForDuration(playerOneStream),
        ).toMatchObject({
            feed: [
                {
                    type: "error",
                    message: "You do not have enough mind to bruise.",
                    event: "feed",
                },
            ],
            entities: [],
            cta: [],
            action: [],
        });
    });

    test("Ability in range", async () => {
        playerTwo.loc = playerOne.loc;
        playerTwo = await saveEntity(playerTwo);

        crossoverCmdPerformAbility(
            { target: playerTwo.player, ability: abilities.bruise.ability },
            { Cookie: playerOneCookies },
        );
        let playerOneEvs;
        let playerTwoEvs;
        collectAllEventDataForDuration(playerOneStream).then(
            (evs) => (playerOneEvs = evs),
        );
        collectAllEventDataForDuration(playerTwoStream).then(
            (evs) => (playerTwoEvs = evs),
        );
        await sleep(MS_PER_TICK * 4 * 2);

        expect(playerOneEvs).toMatchObject({
            feed: [
                {
                    type: "message",
                    message: "Gandalf bashes Saruman, dealing 12 damage!",
                    event: "feed",
                },
                {
                    type: "message",
                    message: "You killed Saruman, his collapses at your feet.",
                    event: "feed",
                },
            ],
            entities: [
                {
                    event: "entities",
                    players: [
                        minifiedEntity(
                            await consumeResources(
                                playerOne,
                                abilities.bruise.cost,
                                false,
                            ),
                            { stats: true },
                        ),
                    ],
                    monsters: [],
                    items: [],
                    op: "upsert",
                },
                {
                    event: "entities",
                    players: [
                        {
                            player: playerTwo.player,
                            hp: -1,
                        },
                    ],
                    monsters: [],
                    items: [],
                    op: "upsert",
                },
                {
                    event: "entities",
                    players: [
                        minifiedEntity(
                            await awardKillCurrency(
                                playerOne,
                                playerTwo,
                                false,
                            ),
                            { stats: true },
                        ),
                    ],
                    monsters: [],
                    items: [],
                    op: "upsert",
                },
            ],
            cta: [],
            action: [
                {
                    ability: "bruise",
                    source: playerOne.player,
                    target: playerTwo.player,
                    event: "action",
                },
            ],
        });

        expect(playerTwoEvs).toMatchObject({
            feed: [
                {
                    type: "message",
                    message: "Gandalf bashes Saruman, dealing 12 damage!",
                    event: "feed",
                },
                {
                    type: "message",
                    message: `As your vision fades, a cold darkness envelops your senses.
You feel weightless, adrift in a void between life and death.
Time seems meaningless here, yet you sense that you are bound—unable to move, unable to act.
But something tells you that this is not the end.`,
                    event: "feed",
                },
            ],
            entities: [
                {
                    event: "entities",
                    players: [
                        {
                            name: "Saruman",
                            player: playerTwo.player,
                            hp: -1,
                        },
                    ],
                    monsters: [],
                    items: [],
                    op: "upsert",
                },
                {
                    event: "entities",
                    players: [
                        minifiedEntity(respawnPlayer(playerTwo), {
                            stats: true,
                            location: true,
                            timers: true,
                        }),
                    ],
                    monsters: [],
                    items: [],
                    op: "upsert",
                },
            ],
            cta: [],
            action: [
                {
                    ability: "bruise",
                    source: playerOne.player,
                    target: playerTwo.player,
                    event: "action",
                },
            ],
        });
    });

    test("Teleport ability", async () => {
        playerOne.cha = 20;
        playerOne.mnd = 20;
        playerOne = await saveEntity(playerOne);

        // Note: after consume resources, the player cannot have more resources than his Max (using `entityStats`)

        crossoverCmdPerformAbility(
            { target: playerTwo.player, ability: abilities.teleport.ability },
            { Cookie: playerOneCookies },
        );
        let playerOneEvs;
        let playerTwoEvs;
        collectAllEventDataForDuration(playerOneStream).then(
            (evs) => (playerOneEvs = evs),
        );
        collectAllEventDataForDuration(playerTwoStream).then(
            (evs) => (playerTwoEvs = evs),
        );
        await sleep(MS_PER_TICK * 4 * 2);

        expect(playerOneEvs).toMatchObject({
            feed: [
                {
                    type: "message",
                    message: "Gandalf teleport himself",
                    event: "feed",
                },
            ],
            entities: [
                {
                    event: "entities",
                    players: [
                        minifiedEntity(
                            await consumeResources(
                                playerOne,
                                abilities.teleport.cost,
                                false,
                            ),
                            { stats: true },
                        ),
                    ],
                    monsters: [],
                    items: [],
                    op: "upsert",
                },
                {
                    event: "entities",
                    players: [
                        {
                            player: playerOne.player,
                            loc: playerTwo.loc,
                            locT: "geohash",
                            locI: "@",
                        },
                    ],
                    monsters: [],
                    items: [],
                    op: "upsert",
                },
            ],
            cta: [],
            action: [
                {
                    ability: "teleport",
                    source: playerOne.player,
                    target: playerOne.player,
                    event: "action",
                },
            ],
        });

        expect(playerTwoEvs).toMatchObject({
            feed: [
                {
                    type: "message",
                    message: "Gandalf teleport himself",
                    event: "feed",
                },
            ],
            entities: [
                {
                    event: "entities",
                    players: [
                        {
                            player: playerOne.player,
                            loc: playerTwo.loc,
                            locT: "geohash",
                            locI: "@",
                        },
                    ],
                    monsters: [],
                    items: [],
                    op: "upsert",
                },
            ],
            cta: [],
            action: [
                {
                    ability: "teleport",
                    source: playerOne.player,
                    target: playerOne.player,
                    event: "action",
                },
            ],
        });
    });

    test("Patch `patchEffectWithVariables`", () => {
        // Test `teleport`
        const teleportEffect = abilities.teleport.procedures[0][1];
        const actualEffect = patchEffectWithVariables({
            self: playerOne as PlayerEntity,
            target: playerTwo as PlayerEntity,
            effect: teleportEffect,
        });
        expect(actualEffect).toMatchObject({
            target: "self",
            states: {
                loc: {
                    value: playerTwo.loc, // patch array
                    op: "change",
                },
                locT: {
                    value: playerTwo.locT, // patch string
                    op: "change",
                },
            },
        });

        // Test `hpSwap`
        playerOne.hp = 10;
        playerTwo.hp = 20;
        const swapEffect1 = abilities.hpSwap.procedures[0][1];
        const swapEffect2 = abilities.hpSwap.procedures[1][1];
        expect(
            patchEffectWithVariables({
                self: playerOne as PlayerEntity,
                target: playerTwo as PlayerEntity,
                effect: swapEffect1,
            }),
        ).toMatchObject({
            target: "self",
            states: {
                hp: {
                    value: playerTwo.hp, // patch number
                    op: "change",
                },
            },
        });
        expect(
            patchEffectWithVariables({
                self: playerOne as PlayerEntity,
                target: playerTwo as PlayerEntity,
                effect: swapEffect2,
            }),
        ).toMatchObject({
            target: "target",
            states: {
                hp: {
                    value: playerOne.hp, // patch number
                    op: "change",
                },
            },
        });
    });
});
