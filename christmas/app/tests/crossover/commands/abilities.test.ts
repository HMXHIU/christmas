import { executeGameCommand } from "$lib/crossover/game";
import { searchPossibleCommands, type GameCommand } from "$lib/crossover/ir";
import { abilities } from "$lib/crossover/world/settings/abilities";
import { SkillLinesEnum } from "$lib/crossover/world/skills";
import { initializeClients } from "$lib/server/crossover/redis";
import { beforeAll, beforeEach, describe, expect, test } from "vitest";
import {
    createGandalfSarumanSauron,
    createGoblinSpiderDragon,
    createTestItems,
    resetMonsterResources,
    resetPlayerResources,
    waitForEventData,
} from "../utils";

await initializeClients(); // create redis repositories

let { geohash, playerOne, playerOneCookies, playerOneStream, playerTwo } =
    await createGandalfSarumanSauron();
let { dragon, goblin } = await createGoblinSpiderDragon(geohash);
let { woodenDoor, woodenClub } = await createTestItems({});

beforeAll(async () => {});

beforeEach(async () => {
    playerOne.loc = [geohash];
    resetPlayerResources(playerOne, playerTwo);
    resetMonsterResources(goblin, dragon);
});

describe("Command Tests", () => {
    test("Use ability on monster", async () => {
        const scratchGoblin: GameCommand = searchPossibleCommands({
            query: "scratch goblin",
            player: playerOne,
            playerAbilities: [
                abilities.scratch,
                abilities.bandage,
                abilities.swing,
            ],
            playerItems: [woodenClub],
            actions: [],
            monsters: [goblin, dragon],
            players: [playerOne],
            items: [woodenDoor],
            skills: [...SkillLinesEnum],
        }).commands[0];

        executeGameCommand(scratchGoblin, { Cookie: playerOneCookies });

        let result = await waitForEventData(playerOneStream, "entities");
        expect(result).toMatchObject({
            event: "entities",
            players: [{ player: playerOne.player, st: 10, ap: 3 }],
            monsters: [],
            items: [],
        });

        result = await waitForEventData(playerOneStream, "entities");
        expect(result).toMatchObject({
            event: "entities",
            players: [{ player: playerOne.player, st: 10, ap: 3 }],
            monsters: [{ monster: goblin.monster, hp: 9, mp: 10, st: 10 }],
            items: [],
        });
    });
});
