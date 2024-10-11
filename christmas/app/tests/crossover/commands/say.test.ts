import { searchPossibleCommands } from "$lib/crossover/ir";
import { abilities } from "$lib/crossover/world/settings/abilities";
import { actions } from "$lib/crossover/world/settings/actions";
import { SkillLinesEnum } from "$lib/crossover/world/skills";
import { describe, expect, test } from "vitest";
import {
    createGandalfSarumanSauron,
    createGoblinSpiderDragon,
    createTestItems,
} from "../utils";

describe("Say Tests", async () => {
    let { geohash, playerOne, playerTwo } = await createGandalfSarumanSauron();
    let { dragon } = await createGoblinSpiderDragon(geohash);
    let { woodenDoor, woodenClub } = await createTestItems({});

    test("Say action with message to specific target", () => {
        // Test commands search
        const { commands } = searchPossibleCommands({
            query: "say saruman thou shall not pass",
            player: playerOne,
            actions: [actions.look, actions.say],
            playerAbilities: [abilities.bruise],
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

    test("Say action with message to everyone", () => {
        // Test commands search
        const { commands } = searchPossibleCommands({
            query: "say hello",
            player: playerOne,
            actions: [actions.look, actions.say],
            playerAbilities: [abilities.bruise],
            playerItems: [woodenClub],
            monsters: [dragon],
            players: [playerTwo],
            items: [woodenDoor, woodenClub],
            skills: [...SkillLinesEnum],
        });

        const [, , variables] = commands[0];
        expect(variables).toMatchObject({
            query: "say hello",
            queryIrrelevant: "hello",
        });
    });

    test("Say action with message to everyone with entity names in message", () => {
        // Test commands search
        const { commands } = searchPossibleCommands({
            query: `say kill ${playerTwo.name}`,
            player: playerOne,
            actions: [actions.look, actions.say],
            playerAbilities: [abilities.bruise],
            playerItems: [woodenClub],
            monsters: [dragon],
            players: [playerTwo],
            items: [woodenDoor, woodenClub],
            skills: [...SkillLinesEnum],
        });

        const [, , variables] = commands[0];
        expect(variables).toMatchObject({
            query: `say kill ${playerTwo.name}`.toLowerCase(),
            queryIrrelevant: `kill ${playerTwo.name}`.toLowerCase(),
        });
    });
});
