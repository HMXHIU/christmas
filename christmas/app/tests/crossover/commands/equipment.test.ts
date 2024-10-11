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

describe("Equipment & Inventory Tests", async () => {
    let { geohash, playerOne } = await createGandalfSarumanSauron();
    let { dragon, goblin } = await createGoblinSpiderDragon(geohash);
    let { woodenClubTwo, woodenClubThree, woodenClub } = await createTestItems(
        {},
    );

    test("Drop action only for inventory items", async () => {
        // woodenClubTwo in inventory (can drop)
        woodenClubTwo.locT = "inv";
        woodenClubTwo.loc = [playerOne.player];

        // woodenClub equipped (can't drop)
        woodenClub.locT = "rh";
        woodenClub.loc = [playerOne.player];

        const commands = searchPossibleCommands({
            query: `drop woodenClub`,
            player: playerOne,
            actions: [actions.drop],
            playerAbilities: [abilities.bruise, abilities.bandage],
            playerItems: [woodenClubTwo, woodenClub],
            monsters: [dragon, goblin],
            players: [],
            items: [woodenClubThree],
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
                    query: `drop woodenclub`,
                    queryIrrelevant: "",
                },
            ],
        ]);
    });
});
