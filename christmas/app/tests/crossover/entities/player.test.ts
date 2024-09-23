import {
    entityAbilities,
    entityActions,
    entityAttributes,
    entityLevel,
    entitySkills,
    entityStats,
} from "$lib/crossover/world/entity";
import { compendium } from "$lib/crossover/world/settings/compendium";
import { createItem } from "$lib/server/crossover/actions/item";
import { initializeClients } from "$lib/server/crossover/redis";
import { expect, test } from "vitest";
import { createGandalfSarumanSauron } from "../utils";

await initializeClients(); // create redis repositories

let {
    region,
    geohash,
    playerOne,
    playerTwo,
    playerOneCookies,
    playerTwoCookies,
    playerOneStream,
    playerTwoStream,
} = await createGandalfSarumanSauron();

test("Test Player Abilities, Actions, Attributes, Level, Skills, Stats", async () => {
    // Check abilities
    const abilities = entityAbilities(playerOne);
    expect(abilities).toMatchObject(["bandage"]);

    // Check actions
    const actions = entityActions(playerOne);
    expect(actions).toMatchObject([
        "look",
        "say",
        "move",
        "inventory",
        "attack",
    ]);

    // Check attributes
    const attributes = entityAttributes(playerOne);
    expect(attributes).toMatchObject({
        str: 14,
        dex: 13,
        con: 13,
        mnd: 10,
        fth: 13,
        cha: 11,
    });

    // Check level
    const level = entityLevel(playerOne);
    expect(level).toEqual(1);

    // Check skills
    const skills = entitySkills(playerOne);
    expect(skills).toMatchObject({
        exploration: 1,
        firstaid: 1,
    });

    // Check stats
    const stats = entityStats(playerOne);
    expect(stats).toMatchObject({
        hp: 11,
        mnd: 1,
        cha: 1,
    });
});

test("Test Player Equipment", async () => {
    // TODO:
    let steelPlate = await createItem(
        playerTwo,
        geohash,
        compendium.steelplate.prop,
    );
    const steelPauldron = await createItem(
        playerTwo,
        geohash,
        compendium.steelpauldron.prop,
    );
});
