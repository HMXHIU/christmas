import { stream } from "$lib/crossover/client";
import { executeGameCommand } from "$lib/crossover/game";
import { searchPossibleCommands, type GameCommand } from "$lib/crossover/ir";
import { geohashNeighbour } from "$lib/crossover/utils";
import { entityStats } from "$lib/crossover/world/entity";
import { LOCATION_INSTANCE } from "$lib/crossover/world/settings";
import { abilities } from "$lib/crossover/world/settings/abilities";
import { compendium } from "$lib/crossover/world/settings/compendium";
import { SkillLinesEnum } from "$lib/crossover/world/skills";
import {
    spawnItemAtGeohash,
    spawnMonster,
} from "$lib/server/crossover/dungeonMaster";
import { initializeClients, saveEntity } from "$lib/server/crossover/redis";
import type {
    Item,
    ItemEntity,
    Monster,
    MonsterEntity,
    Player,
    PlayerEntity,
} from "$lib/server/crossover/redis/entities";
import { beforeAll, beforeEach, describe, expect, test } from "vitest";
import { getRandomRegion } from "../../utils";
import {
    createRandomPlayer,
    createWorldAsset,
    generateRandomGeohash,
    waitForEventData,
} from "../utils";

const region = String.fromCharCode(...getRandomRegion());
const playerOneGeohash = generateRandomGeohash(8, "h9");

let playerOne: Player;
let playerTwo: Player;
let playerOneCookies: string;
let playerTwoCookies: string;
let eventStreamOne: EventTarget;
let eventStreamTwo: EventTarget;
let woodendoor: Item;
let woodenclub: Item;
let woodenclub2: Item;
let woodenclub3: Item;
let tavern: ItemEntity;
let tavernGeohash: string;
let portal: Item;
let dragon: Monster;
let goblin: Monster;

beforeAll(async () => {
    await initializeClients(); // create redis repositories

    // Create Players
    [, playerOneCookies, playerOne] = await createRandomPlayer({
        region,
        geohash: playerOneGeohash,
        name: "Gandalf",
    });
    [, playerTwoCookies, playerTwo] = await createRandomPlayer({
        region,
        geohash: playerOneGeohash,
        name: "Saruman",
    });

    // Create streams
    [eventStreamOne] = await stream({ Cookie: playerOneCookies });
    await expect(
        waitForEventData(eventStreamOne, "feed"),
    ).resolves.toMatchObject({
        type: "system",
        message: "started",
    });
    [eventStreamTwo] = await stream({ Cookie: playerTwoCookies });
    await expect(
        waitForEventData(eventStreamTwo, "feed"),
    ).resolves.toMatchObject({
        type: "system",
        message: "started",
    });

    // Spawn items and monsters
    woodendoor = (await spawnItemAtGeohash({
        geohash: geohashNeighbour(playerOneGeohash, "n"),
        prop: compendium.woodendoor.prop,
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        variables: {
            [compendium.woodendoor.variables.doorsign.variable]:
                "A custom door sign",
        },
    })) as ItemEntity;

    woodenclub = (await spawnItemAtGeohash({
        geohash: playerOneGeohash,
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        prop: compendium.woodenclub.prop,
    })) as ItemEntity;

    woodenclub2 = (await spawnItemAtGeohash({
        geohash: playerOneGeohash,
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        prop: compendium.woodenclub.prop,
    })) as ItemEntity;

    woodenclub3 = (await spawnItemAtGeohash({
        geohash: playerOneGeohash,
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        prop: compendium.woodenclub.prop,
    })) as ItemEntity;

    portal = (await spawnItemAtGeohash({
        geohash: playerOne.loc[0],
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        prop: compendium.portal.prop,
    })) as ItemEntity;

    tavernGeohash = generateRandomGeohash(8, "h9");
    const { url } = await createWorldAsset();
    tavern = (await spawnItemAtGeohash({
        geohash: tavernGeohash,
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        prop: compendium.tavern.prop,
        variables: {
            url,
        },
    })) as ItemEntity;

    dragon = await spawnMonster({
        geohash: geohashNeighbour(geohashNeighbour(playerOneGeohash, "s"), "s"),
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        beast: "dragon",
    });

    goblin = await spawnMonster({
        geohash: playerOneGeohash,
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        beast: "goblin",
    });
});

beforeEach(async () => {
    // Reset stats
    playerOne = {
        ...playerOne,
        ...entityStats(playerOne),
        loc: [playerOneGeohash],
    };
    playerOne = (await saveEntity(playerOne as PlayerEntity)) as Player;
    goblin = {
        ...goblin,
        ...entityStats(goblin),
    };
    goblin = (await saveEntity(goblin as MonsterEntity)) as Monster;
    dragon = {
        ...dragon,
        ...entityStats(dragon),
    };
    dragon = (await saveEntity(dragon as MonsterEntity)) as Monster;
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
            playerItems: [woodenclub],
            actions: [],
            monsters: [goblin, dragon],
            players: [playerOne],
            items: [woodendoor],
            skills: [...SkillLinesEnum],
        }).commands[0];

        executeGameCommand(scratchGoblin, { Cookie: playerOneCookies });

        let result = await waitForEventData(eventStreamOne, "entities");
        expect(result).toMatchObject({
            event: "entities",
            players: [{ player: playerOne.player, st: 10, ap: 3 }],
            monsters: [],
            items: [],
        });

        result = await waitForEventData(eventStreamOne, "entities");
        expect(result).toMatchObject({
            event: "entities",
            players: [{ player: playerOne.player, st: 10, ap: 3 }],
            monsters: [{ monster: goblin.monster, hp: 9, mp: 10, st: 10 }],
            items: [],
        });
    });
});
