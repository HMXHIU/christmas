import { searchPossibleCommands } from "$lib/crossover/ir";
import { actions } from "$lib/crossover/world/actions";
import { abilities } from "$lib/crossover/world/settings/abilities";
import { SkillLinesEnum } from "$lib/crossover/world/skills";
import { initializeClients } from "$lib/server/crossover/redis";
import { describe, expect, test } from "vitest";
import {
    createGandalfSarumanSauron,
    createGoblinSpiderDragon,
    createTestItems,
} from "../utils";

await initializeClients(); // create redis repositories

let { geohash, playerOne } = await createGandalfSarumanSauron();
let { dragon, goblin } = await createGoblinSpiderDragon(geohash);
let { woodenClubTwo, woodenClubThree, woodenClub } = await createTestItems({});

describe("Equipment & Inventory Tests", () => {
    test("Drop action only for inventory items", () => {
        woodenClubTwo.locT = "inv";
        woodenClubTwo.loc = [playerOne.player];

        const commands = searchPossibleCommands({
            query: `drop ${woodenClubThree.item}`,
            player: playerOne,
            actions: [actions.drop],
            playerAbilities: [
                abilities.scratch,
                abilities.bandage,
                abilities.swing,
            ],
            playerItems: [woodenClubTwo],
            monsters: [dragon, goblin],
            players: [],
            items: [woodenClubThree, woodenClub],
            skills: [...SkillLinesEnum],
        }).commands;

        expect(commands).toHaveLength(1);
        expect(commands).toMatchObject([
            [
                {
                    action: "drop",
                },
                {
                    self: {
                        player: playerOne.player,
                    },
                    target: {
                        item: woodenClubTwo.item,
                    },
                },
                {
                    query: `drop ${woodenClubThree.item}`,
                    queryIrrelevant: "",
                },
            ],
        ]);
    });
});
