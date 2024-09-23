import { executeGameCommand } from "$lib/crossover/game";
import { searchPossibleCommands } from "$lib/crossover/ir";
import { abilities } from "$lib/crossover/world/settings/abilities";
import { SkillLinesEnum } from "$lib/crossover/world/skills";
import { initializeClients } from "$lib/server/crossover/redis";
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
    allActions,
    collectAllEventDataForDuration,
    createGandalfSarumanSauron,
    createGoblinSpiderDragon,
    createTestItems,
    resetEntityResources,
} from "../utils";

await initializeClients(); // create redis repositories

let { geohash, playerOne, playerOneCookies, playerOneStream, playerTwo } =
    await createGandalfSarumanSauron();
let { dragon, goblin } = await createGoblinSpiderDragon(geohash);
let { woodenDoor, woodenClub } = await createTestItems({});

beforeAll(async () => {
    vi.spyOn(Math, "random").mockImplementation(() => 0.5);
});
afterAll(() => {
    vi.restoreAllMocks();
});

beforeEach(async () => {
    playerOne.loc = [geohash];
    playerOne.skills.exploration = 10;
    playerOne.skills.dirtyfighting = 10;
    await resetEntityResources(playerOne, playerTwo);
    await resetEntityResources(goblin, dragon);
});

describe("Attack Tests", () => {
    test("Attack monster", async () => {
        const commands = searchPossibleCommands({
            query: "attack goblin",
            player: playerOne,
            playerAbilities: [abilities.bruise, abilities.bandage],
            playerItems: [woodenClub],
            actions: allActions,
            monsters: [goblin, dragon],
            players: [playerOne],
            items: [woodenDoor],
            skills: [...SkillLinesEnum],
        }).commands;

        expect(commands).toMatchObject([
            [
                {
                    action: "attack",
                },
                {
                    self: {
                        player: playerOne.player,
                    },
                    target: {
                        monster: goblin.monster,
                    },
                },
                {
                    query: "attack goblin",
                    queryIrrelevant: "",
                },
            ],
        ]);

        executeGameCommand(commands[0], { Cookie: playerOneCookies });
        const evs = await collectAllEventDataForDuration(playerOneStream, 500);
        expect(evs).toMatchObject({
            feed: [
                {
                    type: "message",
                    message: "Gandalf strikes goblin, dealing 3 damage!",
                    event: "feed",
                },
            ],
            entities: [
                {
                    event: "entities",
                    players: [],
                    monsters: [
                        {
                            monster: goblin.monster,
                            hp: 7,
                        },
                    ],
                    items: [],
                    op: "upsert",
                },
            ],
            cta: [],
            action: [
                {
                    action: "attack",
                    source: playerOne.player,
                    target: goblin.monster,
                    event: "action",
                },
            ],
        });
    });
});
