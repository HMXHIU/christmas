import { executeGameCommand } from "$lib/crossover/game";
import { searchPossibleCommands, type GameCommand } from "$lib/crossover/ir";
import { awardKillCurrency } from "$lib/crossover/world/entity";
import { abilities } from "$lib/crossover/world/settings/abilities";
import { SkillLinesEnum } from "$lib/crossover/world/skills";
import { consumeResources } from "$lib/server/crossover";
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

describe("Command Tests", () => {
    test("Use ability on monster", async () => {
        const scratchGoblin: GameCommand = searchPossibleCommands({
            query: "bruise goblin",
            player: playerOne,
            playerAbilities: [abilities.bruise, abilities.bandage],
            playerItems: [woodenClub],
            actions: [],
            monsters: [goblin, dragon],
            players: [playerOne],
            items: [woodenDoor],
            skills: [...SkillLinesEnum],
        }).commands[0];
        executeGameCommand(scratchGoblin, { Cookie: playerOneCookies });

        const evs = await collectAllEventDataForDuration(playerOneStream, 1000);
        expect(evs).toMatchObject({
            feed: [
                {
                    type: "message",
                    message: "Gandalf bashes goblin, dealing 13 damage!",
                    event: "feed",
                },
                {
                    type: "message",
                    message: "You killed goblin, their collapses at your feet.",
                    event: "feed",
                },
            ],
            entities: [
                {
                    event: "entities",
                    players: [
                        {
                            player: playerOne.player,
                            ...consumeResources(
                                playerOne,
                                abilities.bruise.cost,
                                false,
                            ),
                        },
                    ],
                    monsters: [],
                    items: [],
                    op: "upsert",
                },
                {
                    event: "entities",
                    players: [],
                    monsters: [
                        {
                            monster: goblin.monster,
                            hp: -3,
                            cha: 1,
                            mnd: 1,
                            lum: 0,
                            umb: 0,
                        },
                    ],
                    items: [],
                    op: "upsert",
                },
                {
                    event: "entities",
                    players: [
                        {
                            player: playerOne.player,
                            ...awardKillCurrency(playerOne, goblin, false),
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
                    ability: "bruise",
                    source: playerOne.player,
                    target: goblin.monster,
                    event: "action",
                },
            ],
        });
    });
});
