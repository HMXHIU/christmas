import {
    crossoverCmdAttack,
    crossoverCmdEquip,
    crossoverCmdTake,
} from "$lib/crossover/client";
import { LOCATION_INSTANCE, MS_PER_TICK } from "$lib/crossover/world/settings";
import { fetchEntity, saveEntity } from "$lib/server/crossover/redis/utils";
import type { ItemEntity } from "$lib/server/crossover/types";
import { sleep } from "$lib/utils";
import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    test,
    vi,
} from "vitest";
import {
    collectAllEventDataForDuration,
    createGandalfSarumanSauron,
    createTestItems,
    flushStream,
    generateRandomGeohash,
    resetEntityResources,
} from "../utils";

let {
    region,
    geohash,
    playerOne,
    playerTwo,
    playerThree,
    playerOneCookies,
    playerOneStream,
    playerTwoStream,
} = await createGandalfSarumanSauron();

let { woodenClub } = await createTestItems({});

beforeAll(async () => {
    vi.spyOn(Math, "random").mockImplementation(() => 0.5);

    // Configure player positions
    playerOne.loc = [geohash];
    playerOne = await saveEntity(playerOne);
    playerTwo.loc = [geohash];
    playerTwo = await saveEntity(playerTwo);
    playerThree.loc = [geohash];
    playerThree = await saveEntity(playerThree);

    // Give skills
    playerOne.skills.exploration = 10;
    playerOne = await saveEntity(playerOne);
});

afterAll(() => {
    vi.restoreAllMocks();
});

beforeEach(async () => {
    // Reset entities locations & resources
    playerOne.loc = [geohash];
    playerOne.locT = "geohash";
    playerOne.locI = LOCATION_INSTANCE;

    playerTwo.loc = [geohash];
    playerTwo.locT = "geohash";
    playerTwo.locI = LOCATION_INSTANCE;

    playerThree.loc = [geohash];
    playerThree.locT = "geohash";
    playerThree.locI = LOCATION_INSTANCE;

    await resetEntityResources(playerOne, playerTwo, playerThree);

    woodenClub.loc = [geohash];
    woodenClub.locT = "geohash";
    woodenClub.locI = LOCATION_INSTANCE;

    woodenClub = await saveEntity(woodenClub);
});

describe("Test Attack", () => {
    test("Test Attack Out Of Range", async () => {
        playerTwo.loc = [generateRandomGeohash(8, "h9")];
        playerTwo = await saveEntity(playerTwo);

        crossoverCmdAttack(
            { target: playerTwo.player },
            { Cookie: playerOneCookies },
        );

        let evs = await collectAllEventDataForDuration(playerOneStream, 500);
        expect(evs).toMatchObject({
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

    test("Test Unarmed Attack", async () => {
        crossoverCmdAttack(
            { target: playerTwo.player },
            { Cookie: playerOneCookies },
        );

        let playerOneEvs;
        let playerTwoEvs;
        collectAllEventDataForDuration(playerOneStream, 500).then(
            (evs) => (playerOneEvs = evs),
        );
        collectAllEventDataForDuration(playerTwoStream, 500).then(
            (evs) => (playerTwoEvs = evs),
        );
        await sleep(500);

        expect(playerOneEvs).toMatchObject({
            feed: [
                {
                    type: "message",
                    message: "Gandalf strikes Saruman, dealing 3 damage!",
                    event: "feed",
                },
            ],
            entities: [
                {
                    event: "entities",
                    players: [
                        {
                            player: playerTwo.player,
                            hp: 8,
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
                    action: "attack",
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
                    message: "Gandalf strikes Saruman, dealing 3 damage!",
                    event: "feed",
                },
            ],
            entities: [
                {
                    event: "entities",
                    players: [
                        {
                            player: playerTwo.player,
                            hp: 8,
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
                    action: "attack",
                    source: playerOne.player,
                    target: playerTwo.player,
                    event: "action",
                },
            ],
        });
    });

    test("Test Weapon Attack", async () => {
        await crossoverCmdTake(
            { item: woodenClub.item },
            { Cookie: playerOneCookies },
        );
        await sleep(MS_PER_TICK * 2);

        await crossoverCmdEquip(
            { item: woodenClub.item, slot: "rh" },
            { Cookie: playerOneCookies },
        );
        await sleep(MS_PER_TICK * 8);

        // Check weapon is equipped
        woodenClub = (await fetchEntity(woodenClub.item)) as ItemEntity;
        expect(woodenClub).toMatchObject({
            loc: [playerOne.player],
            locT: "rh",
            locI: "@",
        });

        let playerOneEvs;
        let playerTwoEvs;
        await flushStream(playerOneStream);
        crossoverCmdAttack(
            { target: playerTwo.player },
            { Cookie: playerOneCookies },
        );
        collectAllEventDataForDuration(playerOneStream, 500).then(
            (evs) => (playerOneEvs = evs),
        );
        collectAllEventDataForDuration(playerTwoStream, 500).then(
            (evs) => (playerTwoEvs = evs),
        );
        await sleep(500);

        expect(playerOneEvs).toMatchObject({
            feed: [
                {
                    type: "message",
                    message: "Gandalf strikes Saruman, dealing 6 damage!",
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
                            hp: 5,
                        },
                    ],
                    monsters: [],
                    items: [
                        {
                            name: "Wooden Club",
                            item: woodenClub.item,
                            prop: "woodenclub",
                            state: "default",
                            vars: {},
                            dur: woodenClub.dur - 1, // each attack reduces 1 dur
                            loc: [playerOne.player],
                            locT: "rh",
                            locI: "@",
                        },
                    ],
                    op: "upsert",
                },
            ],
            cta: [],
            action: [
                {
                    action: "attack",
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
                    message: "Gandalf strikes Saruman, dealing 6 damage!",
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
                            hp: 5,
                        },
                    ],
                    monsters: [],
                    items: [
                        {
                            name: "Wooden Club",
                            item: woodenClub.item,
                            prop: "woodenclub",
                            state: "default",
                            vars: {},
                            dur: woodenClub.dur - 1, // each attack reduces 1 dur
                            loc: [playerOne.player],
                            locT: "rh",
                            locI: "@",
                        },
                    ],
                    op: "upsert",
                },
            ],
            cta: [],
            action: [
                {
                    action: "attack",
                    source: playerOne.player,
                    target: playerTwo.player,
                    event: "action",
                },
            ],
        });
    });
});
