import { crossoverCmdEquip, crossoverCmdTake } from "$lib/crossover/client";
import { executeGameCommand } from "$lib/crossover/game";
import { searchPossibleCommands, type GameCommand } from "$lib/crossover/ir";
import { geohashNeighbour } from "$lib/crossover/utils";
import { actions } from "$lib/crossover/world/actions";
import { LOCATION_INSTANCE, MS_PER_TICK } from "$lib/crossover/world/settings";
import { abilities } from "$lib/crossover/world/settings/abilities";
import { compendium } from "$lib/crossover/world/settings/compendium";
import { SkillLinesEnum } from "$lib/crossover/world/skills";
import {
    initializeClients,
    saveEntities,
    saveEntity,
} from "$lib/server/crossover/redis";
import { sleep } from "$lib/utils";
import { beforeAll, beforeEach, describe, expect, test } from "vitest";
import {
    allActions,
    createGandalfSarumanSauron,
    createGoblinSpiderDragon,
    createTestItems,
    resetMonsterResources,
    resetPlayerResources,
    waitForEventData,
} from "../utils";

await initializeClients(); // create redis repositories

let { geohash, playerOne, playerOneCookies, playerOneStream } =
    await createGandalfSarumanSauron();
let { dragon, goblin } = await createGoblinSpiderDragon(geohash);
let {
    woodenClubTwo,
    woodenClubThree,
    woodenClub,
    woodenDoor,
    tavern,
    portalOne,
} = await createTestItems({});

beforeAll(async () => {
    playerOne.loc = [portalOne.loc[0]];
    woodenClub.loc = woodenClubTwo.loc = woodenClubThree.loc = playerOne.loc;
    dragon.loc = [
        geohashNeighbour(geohashNeighbour(playerOne.loc[0], "s"), "s"),
    ];
    goblin.loc = playerOne.loc;
    await saveEntities(
        playerOne,
        woodenClub,
        woodenClubTwo,
        woodenClubThree,
        dragon,
        goblin,
    );
});

beforeEach(async () => {
    playerOne.loc = [portalOne.loc[0]];
    playerOne.locI = LOCATION_INSTANCE;
    playerOne.locT = "geohash";

    await resetPlayerResources(playerOne);
    await resetMonsterResources(goblin, dragon);

    woodenClub.loc = [portalOne.loc[0]];
    woodenClub.locI = LOCATION_INSTANCE;
    woodenClub.locT = "geohash";
    woodenClub.chg = compendium.woodenclub.charges;
    woodenClub.dur = compendium.woodenclub.durability;
    woodenClub = await saveEntity(woodenClub);
});

describe("Item Tests", () => {
    test("Enter tavern", async () => {
        // Move to tavern
        playerOne.loc = [tavern.loc[0]];
        playerOne = await saveEntity(playerOne);

        // Test command search
        const { commands, queryTokens, tokenPositions } =
            searchPossibleCommands({
                query: "enter tavern",
                player: playerOne,
                playerAbilities: [
                    abilities.scratch,
                    abilities.bandage,
                    abilities.swing,
                ],
                playerItems: [woodenClub],
                actions: allActions,
                monsters: [goblin, dragon],
                players: [playerOne],
                items: [woodenDoor, tavern],
                skills: [...SkillLinesEnum],
            });
        expect(queryTokens).toMatchObject(["enter", "tavern"]);
        expect(tokenPositions).toMatchObject({
            [tavern.item]: {
                "1": {
                    token: "tavern",
                    score: 1,
                },
            },
            enter: {
                "0": {
                    token: "enter",
                    score: 1,
                },
            },
        });
        expect(commands).toMatchObject([
            [
                {
                    action: "enter",
                    description: "Enter.",
                    predicate: {
                        target: ["item"],
                        tokenPositions: {
                            action: 0,
                            target: 1,
                        },
                    },
                },
                {
                    self: {
                        player: playerOne.player,
                    },
                    target: {
                        item: tavern.item,
                    },
                },
                {
                    query: "enter tavern",
                    queryIrrelevant: "",
                },
            ],
        ]);

        // Test enter tavern
        executeGameCommand(commands[0], { Cookie: playerOneCookies });
        let entities = await waitForEventData(playerOneStream, "entities");

        expect(entities).toMatchObject({
            event: "entities",
            players: [
                {
                    player: playerOne.player,
                    locT: "in",
                    locI: tavern.item,
                },
            ],
            monsters: [],
            items: [],
            op: "upsert",
        });

        // Test exit tavern
    });

    test("Open and close door", async () => {
        // Move to woodenDoor
        playerOne.loc = [woodenDoor.loc[0]];
        playerOne = await saveEntity(playerOne);

        // Test open door
        const openDoor: GameCommand = searchPossibleCommands({
            query: "open woodenDoor",
            player: playerOne,
            playerAbilities: [
                abilities.scratch,
                abilities.bandage,
                abilities.swing,
            ],
            playerItems: [woodenClub],
            actions: [],
            monsters: [goblin, dragon],
            players: [playerOne],
            items: [woodenDoor],
            skills: [...SkillLinesEnum],
        }).commands[0];
        executeGameCommand(openDoor, { Cookie: playerOneCookies });
        let result = await waitForEventData(playerOneStream, "entities");
        await sleep(MS_PER_TICK * 4);

        expect(result).toMatchObject({
            event: "entities",
            players: [],
            monsters: [],
            items: [{ item: woodenDoor.item, state: "open" }],
        });

        // Test close door
        const closeDoor: GameCommand = searchPossibleCommands({
            query: "close woodenDoor",
            player: playerOne,
            playerAbilities: [
                abilities.scratch,
                abilities.bandage,
                abilities.swing,
            ],
            playerItems: [woodenClub],
            actions: [],
            monsters: [goblin, dragon],
            players: [playerOne],
            items: [woodenDoor],
            skills: [...SkillLinesEnum],
        }).commands[0];
        executeGameCommand(closeDoor, { Cookie: playerOneCookies });
        result = await waitForEventData(playerOneStream, "entities");
        await sleep(MS_PER_TICK * 4);
        expect(result).toMatchObject({
            event: "entities",
            players: [],
            monsters: [],
            items: [{ item: woodenDoor.item, state: "closed" }],
        });
    });

    test("Use utility on monster", async () => {
        // Take wooden club
        crossoverCmdTake(
            { item: woodenClub.item },
            { Cookie: playerOneCookies },
        );
        await waitForEventData(playerOneStream, "entities"); // Wait for look update
        await sleep(MS_PER_TICK * actions.take.ticks * 2); // wait till not busy

        // Equip wooden club
        crossoverCmdEquip(
            { item: woodenClub.item, slot: "rh" },
            { Cookie: playerOneCookies },
        );
        await waitForEventData(playerOneStream, "entities"); // Wait for inventory update
        await sleep(MS_PER_TICK * actions.equip.ticks * 2); // wait till not busy

        // Swing wooden club at goblin
        const swingGoblin: GameCommand = searchPossibleCommands({
            query: "swing goblin",
            player: playerOne,
            playerAbilities: [abilities.scratch, abilities.bandage],
            playerItems: [woodenClub],
            actions: [],
            monsters: [goblin, dragon],
            players: [playerOne],
            items: [woodenDoor],
            skills: [...SkillLinesEnum],
        }).commands[0];
        expect(swingGoblin).toMatchObject([
            {
                utility: "swing",
            },
            {
                self: {
                    player: playerOne.player,
                },
                target: {
                    monster: goblin.monster,
                },
                item: {
                    item: woodenClub.item,
                },
            },
        ]);
        executeGameCommand(swingGoblin, { Cookie: playerOneCookies });

        let result = await waitForEventData(playerOneStream, "entities");
        expect(result).toMatchObject({
            event: "entities",
            players: [{ player: playerOne.player, hp: 11, mp: 12, st: 11 }],
            monsters: [{ monster: goblin.monster, hp: 9 }],
            items: [],
        });

        result = await waitForEventData(playerOneStream, "entities");
        expect(result).toMatchObject({
            event: "entities",
            players: [],
            monsters: [],
            items: [
                { item: woodenClub.item, dur: 99, chg: 0, state: "default" },
            ],
        });
    });
});
