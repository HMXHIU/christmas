import { searchPossibleCommands } from "$lib/crossover/ir";
import { abilities } from "$lib/crossover/world/settings/abilities";
import { actions } from "$lib/crossover/world/settings/actions";
import { SkillLinesEnum } from "$lib/crossover/world/skills";
import { initializeClients } from "$lib/server/crossover/redis";
import { describe, expect, test } from "vitest";
import {
    createGandalfSarumanSauron,
    createGoblinSpiderDragon,
    createTestItems,
} from "../utils";

await initializeClients(); // create redis repositories

let { geohash, playerOne, playerTwo } = await createGandalfSarumanSauron();
let { dragon } = await createGoblinSpiderDragon(geohash);
let { woodenDoor, woodenClub } = await createTestItems({});

describe("Say Tests", () => {
    test("Say action with message", () => {
        // Test commands search
        const { commands } = searchPossibleCommands({
            query: "say saruman thou shall not pass",
            player: playerOne,
            actions: [actions.look, actions.say],
            playerAbilities: [abilities.scratch],
            playerItems: [woodenClub],
            monsters: [dragon],
            players: [playerTwo],
            items: [woodenDoor, woodenClub],
            skills: [...SkillLinesEnum],
        });

        const [, , variables] = commands[0];
        expect(variables).toMatchObject({
            query: "say saruman thou shall not pass",
            queryIrrelevant: "thou shall not pass",
        });
    });
});
