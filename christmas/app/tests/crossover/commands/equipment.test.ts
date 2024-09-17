import { searchPossibleCommands } from "$lib/crossover/ir";
import { actions } from "$lib/crossover/world/actions";
import { LOCATION_INSTANCE } from "$lib/crossover/world/settings";
import { compendium } from "$lib/crossover/world/settings/compendium";
import { SkillLinesEnum } from "$lib/crossover/world/skills";
import { spawnItemAtGeohash } from "$lib/server/crossover/dungeonMaster";
import { initializeClients } from "$lib/server/crossover/redis";
import type {
    Item,
    ItemEntity,
    Player,
} from "$lib/server/crossover/redis/entities";
import { beforeAll, describe, expect, test } from "vitest";
import { createGandalfSarumanSauron, generateRandomGeohash } from "../utils";

let region: string;
let geohash: string;

let playerOne: Player;
let playerOneCookies: string;
let playerOneStream: EventTarget;
let playerTwo: Player;
let playerTwoCookies: string;
let playerTwoStream: EventTarget;
let playerThree: Player;
let playerThreeCookies: string;
let playerThreeStream: EventTarget;

let woodenclub: Item;
let woodenclub2: Item;
let woodenclub3: Item;

beforeAll(async () => {
    await initializeClients(); // create redis repositories

    // Create players
    ({
        region,
        geohash,
        playerOne,
        playerOneCookies,
        playerOneStream,
        playerTwo,
        playerTwoCookies,
        playerTwoStream,
        playerThree,
        playerThreeCookies,
        playerThreeStream,
    } = await createGandalfSarumanSauron());

    woodenclub = (await spawnItemAtGeohash({
        geohash: generateRandomGeohash(8, "h9"),
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        prop: compendium.woodenclub.prop,
    })) as ItemEntity;

    woodenclub2 = (await spawnItemAtGeohash({
        geohash: generateRandomGeohash(8, "h9"),
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        prop: compendium.woodenclub.prop,
    })) as ItemEntity;

    woodenclub3 = (await spawnItemAtGeohash({
        geohash: generateRandomGeohash(8, "h9"),
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        prop: compendium.woodenclub.prop,
    })) as ItemEntity;
});

describe("Equipment & Inventory Tests", () => {
    test("Drop action only for inventory items", () => {
        woodenclub2.locT = "inv";
        woodenclub2.loc = [playerOne.player];

        const commands = searchPossibleCommands({
            query: `drop ${woodenclub3.item}`,
            player: playerOne,
            actions: [actions.drop],
            playerAbilities: [],
            playerItems: [woodenclub2],
            monsters: [],
            players: [],
            items: [woodenclub3, woodenclub],
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
                        item: woodenclub2.item,
                    },
                },
                {
                    query: `drop ${woodenclub3.item}`,
                    queryIrrelevant: "",
                },
            ],
        ]);
    });
});
