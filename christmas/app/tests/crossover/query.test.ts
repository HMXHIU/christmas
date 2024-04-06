import { abilitiesActionsIR, entitiesIR, tokenize } from "$lib/crossover/ir";
import {
    resolveAbilityEntities,
    type Ability,
} from "$lib/crossover/world/abilities";
import type { PropAction } from "$lib/crossover/world/compendium";
import { abilities, compendium } from "$lib/crossover/world/settings";
import { spawnItem, spawnMonster } from "$lib/server/crossover";
import type { ItemEntity } from "$lib/server/crossover/redis/entities";
import { expect, test } from "vitest";
import { getRandomRegion } from "../utils";
import { createRandomPlayer, generateRandomGeohash } from "./utils";

test("Test Player", async () => {
    const region = String.fromCharCode(...getRandomRegion());

    // Player one
    const playerOneName = "Gandalf";
    const playerOneGeohash = generateRandomGeohash(6);
    let [playerOneWallet, playerOneCookies, playerOne] =
        await createRandomPlayer({
            region,
            geohash: generateRandomGeohash(8, "h9"),
            name: playerOneName,
        });

    // Player two
    const playerTwoName = "Saruman";
    const playerTwoGeohash = generateRandomGeohash(6);
    let [playerTwoWallet, playerTwoCookies, playerTwo] =
        await createRandomPlayer({
            region,
            geohash: generateRandomGeohash(8, "h9"),
            name: playerTwoName,
        });

    // Player three
    const playerThreeName = "Sauron";
    const playerThreeGeohash = playerOneGeohash;
    let [playerThreeWallet, playerThreeCookies, playerThree] =
        await createRandomPlayer({
            region,
            geohash: generateRandomGeohash(8, "h9"),
            name: playerThreeName,
        });

    // Wooden Door
    let woodenDoor = (await spawnItem({
        geohash: generateRandomGeohash(8, "h9"),
        prop: compendium.woodenDoor.prop,
        variables: {
            [compendium.woodenDoor.variables.doorSign.variable]:
                "A custom door sign",
        },
    })) as ItemEntity;

    // Wooden club
    let woodenClub = (await spawnItem({
        geohash: generateRandomGeohash(8, "h9"),
        prop: compendium.woodenClub.prop,
    })) as ItemEntity;

    // Portal
    let portal = (await spawnItem({
        geohash: playerOne.location[0], // spawn at playerOne
        prop: compendium.portal.prop,
    })) as ItemEntity;

    // Dragon
    let dragon = await spawnMonster({
        geohash: generateRandomGeohash(8, "h9"),
        beast: "dragon",
        level: 1,
    });

    // Goblin
    let goblin = await spawnMonster({
        geohash: generateRandomGeohash(8, "h9"),
        beast: "goblin",
        level: 1,
    });

    // Actions & Abilities
    const playerActions: PropAction[] = Object.values(compendium).flatMap(
        (prop) => Object.values(prop.actions),
    );
    const playerAbilities: Ability[] = Object.values(abilities);

    /**
     * Test query flow (player sctratch goblin)
     */

    // Tokenize query
    let query = "scratch goblin";
    let queryTokens = tokenize(query);

    // Retrieve entities relevant to query from the environment
    let { monsters, players, items } = entitiesIR({
        queryTokens,
        monsters: [dragon, goblin],
        players: [playerOne, playerTwo, playerThree],
        items: [woodenDoor, woodenClub, portal],
    });

    // Retrieve actions and abilities relevant to query
    let { actions, abilities: abilitiesRetrieved } = abilitiesActionsIR({
        queryTokens,
        abilities: playerAbilities,
        actions: playerActions,
    });

    // Resolve abilities relevant to retrieved entities
    let abilityEntities = abilitiesRetrieved
        .map((ability) => [
            ability,
            resolveAbilityEntities({
                queryTokens,
                ability: ability.ability,
                self: playerOne,
                monsters,
                players,
                items,
            }),
        ])
        .filter((ability) => ability != null);
    expect(abilityEntities).to.toMatchObject([
        [
            {
                ability: "scratch",
            },
            {
                self: {
                    player: playerOne.player,
                },
                target: {
                    monster: goblin.monster,
                },
            },
        ],
    ]);
});
