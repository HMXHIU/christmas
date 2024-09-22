import { searchPossibleCommands } from "$lib/crossover/ir";
import { abilities } from "$lib/crossover/world/settings/abilities";
import { actions } from "$lib/crossover/world/settings/actions";
import { SkillLinesEnum } from "$lib/crossover/world/skills";
import { initializeClients } from "$lib/server/crossover/redis";
import { saveEntities } from "$lib/server/crossover/redis/utils";
import { describe, expect, test } from "vitest";
import {
    createGandalfSarumanSauron,
    createGoblinSpiderDragon,
    createTestItems,
} from "../utils";

await initializeClients(); // create redis repositories

let { geohash, playerOne, playerTwo } = await createGandalfSarumanSauron();
let { dragon, goblin } = await createGoblinSpiderDragon(geohash);
let { woodenDoor, woodenClub } = await createTestItems({});

describe("Actions Tests", () => {
    test("Look action without target", () => {
        const commands = searchPossibleCommands({
            query: "look",
            player: playerOne,
            actions: [actions.look, actions.say],
            playerAbilities: [abilities.bruise],
            playerItems: [woodenClub],
            monsters: [dragon],
            players: [playerTwo],
            items: [woodenDoor, woodenClub],
            skills: [...SkillLinesEnum],
        }).commands;

        expect(commands).toMatchObject([
            [
                {
                    action: "look",
                    description: actions.look.description,
                },
                {
                    self: {
                        player: playerOne.player,
                    },
                },
                {
                    query: "look",
                    queryIrrelevant: "",
                },
            ],
        ]);
    });

    test("Look action with target", async () => {
        goblin.loc = [playerOne.loc[0]];
        dragon.loc = [playerOne.loc[0]];
        await saveEntities(goblin, dragon);

        const commands = searchPossibleCommands({
            query: `look ${goblin.monster}`,
            player: playerOne,
            actions: [actions.look, actions.say],
            playerAbilities: [abilities.bruise],
            playerItems: [woodenClub],
            monsters: [dragon, goblin],
            players: [playerTwo],
            items: [woodenDoor, woodenClub],
            skills: [...SkillLinesEnum],
        }).commands;

        expect(commands).toMatchObject([
            [
                {
                    action: "look",
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
                    query: `look ${goblin.monster}`,
                    queryIrrelevant: "",
                },
            ],
        ]);
    });

    test("Invalid action (wrong token position)", () => {
        const commands = searchPossibleCommands({
            query: "rejected look",
            player: playerOne,
            actions: [actions.look, actions.say],
            playerAbilities: [abilities.bruise],
            playerItems: [woodenClub],
            monsters: [dragon],
            players: [playerTwo],
            items: [woodenDoor, woodenClub],
            skills: [...SkillLinesEnum],
        }).commands;
        expect(commands.length).toBe(0);
        expect(commands).toMatchObject([]);
    });
});
