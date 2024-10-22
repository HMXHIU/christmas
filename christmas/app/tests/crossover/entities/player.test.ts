import {
    entityAbilities,
    entityActions,
    entityAttributes,
    entityLevel,
    entitySkills,
    entityStats,
} from "$lib/crossover/world/entity";
import { LOCATION_INSTANCE } from "$lib/crossover/world/settings";
import { compendium } from "$lib/crossover/world/settings/compendium";
import { createItem } from "$lib/server/crossover/actions/item";
import { respawnPlayer } from "$lib/server/crossover/combat/utils";
import { spawnLocation } from "$lib/server/crossover/dm";
import { saveEntity } from "$lib/server/crossover/redis/utils";
import { describe, expect, test } from "vitest";
import { createGandalfSarumanSauron } from "../utils";

describe("Test Player Entity", async () => {
    let { region, geohash, playerOne, playerTwo } =
        await createGandalfSarumanSauron();

    test("Test Player Faction, Archetype, Demograpics", async () => {
        expect(playerOne).toMatchObject({
            fac: "historian",
        });
    });

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

        // Check faction
        expect(playerOne.fac).toBe("historian");
    });

    test("Test Player respawn at sanctuary monument", async () => {
        // Set player location (singapore)
        playerOne.loc = ["w21z3wys"];
        playerOne.locT = "geohash";
        playerOne = await saveEntity(playerOne);

        // Spawn location (control monument of sanctuary)
        await spawnLocation(playerOne.loc[0], "d1", LOCATION_INSTANCE);

        // Check respawn player brings him to control monument at d1 sanctuary
        playerOne = await respawnPlayer(playerOne);

        expect(playerOne).toMatchObject({
            player: playerOne.player,
            loc: ["w21z9pum"],
            locT: "d1",
            locI: "@",
            fac: "historian",
        });
    });

    test("Test Player Equipment", async () => {
        let steelPlate = await createItem(
            playerTwo,
            compendium.steelplate.prop,
        );
        const steelPauldron = await createItem(
            playerTwo,
            compendium.steelpauldron.prop,
        );
    });
});
