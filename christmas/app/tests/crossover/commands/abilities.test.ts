import { executeGameCommand } from "$lib/crossover/game";
import { searchPossibleCommands, type GameCommand } from "$lib/crossover/ir";
import { minifiedEntity } from "$lib/crossover/utils";
import { abilities } from "$lib/crossover/world/settings/abilities";
import { SkillLinesEnum } from "$lib/crossover/world/skills";
import { consumeResources } from "$lib/server/crossover";
import { awardKillCurrency } from "$lib/server/crossover/entity";
import { beforeEach, describe, expect, test } from "vitest";
import {
    collectAllEventDataForDuration,
    createGandalfSarumanSauron,
    createGoblinSpiderDragon,
    createTestItems,
    resetEntityResources,
} from "../utils";

describe("Command Tests", async () => {
    let { geohash, playerOne, playerOneCookies, playerOneStream, playerTwo } =
        await createGandalfSarumanSauron();
    let { dragon, goblin } = await createGoblinSpiderDragon(geohash);
    let { woodenDoor, woodenClub } = await createTestItems({});

    beforeEach(async () => {
        playerOne.loc = [geohash];
        playerOne.skills.exploration = 10;
        playerOne.skills.dirtyfighting = 10;
        await resetEntityResources(playerOne, playerTwo);
        await resetEntityResources(goblin, dragon);
    });

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
                    message: "You killed goblin, it collapses at your feet.",
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
                        minifiedEntity(
                            await awardKillCurrency(playerOne, goblin, false),
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
                    target: goblin.monster,
                    event: "action",
                },
            ],
        });
    });
});
