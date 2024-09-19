import type { ItemEntity, PlayerEntity } from "$lib/crossover/types";
import { geohashNeighbour } from "$lib/crossover/utils";
import { itemAttibutes } from "$lib/crossover/world/compendium";
import { LOCATION_INSTANCE, MS_PER_TICK } from "$lib/crossover/world/settings";
import { compendium } from "$lib/crossover/world/settings/compendium";
import {
    configureItem,
    enterItem,
    equipItem,
    takeItem,
    useItem,
} from "$lib/server/crossover/actions/item";
import { spawnItemAtGeohash } from "$lib/server/crossover/dungeonMaster";
import { initializeClients } from "$lib/server/crossover/redis";
import { fetchEntity, saveEntity } from "$lib/server/crossover/redis/utils";
import { itemVariableValue } from "$lib/server/crossover/utils";
import { sleep, substituteValues } from "$lib/utils";
import { cloneDeep } from "lodash";
import { beforeAll, beforeEach, describe, expect, test } from "vitest";
import {
    createGandalfSarumanSauron,
    createTestItems,
    testPlayerUseItemOnPlayer,
    waitForEventData,
} from "../utils";

await initializeClients(); // create redis repositories

let {
    region,
    geohash,
    playerOne,
    playerTwo,
    playerThree,
    playerOneCookies,
    playerOneStream,
    playerTwoStream,
} = await createGandalfSarumanSauron();

let { woodenDoor, portalOne, portalTwo, tavern, worldAsset, worldAssetUrl } =
    await createTestItems({});

beforeAll(async () => {
    // Configure player positions
    playerOne.loc = [portalOne.loc[0]];
    playerOne = await saveEntity(playerOne);
    playerTwo.loc = [portalTwo.loc[0]];
    playerTwo = await saveEntity(playerTwo);
    playerThree.loc = [woodenDoor.loc[0]];
    playerThree = await saveEntity(playerThree);

    // Test item location (more than 1 cell)
    const portalTwoGeohash = portalTwo.loc[0];
    expect(portalTwo.loc).toMatchObject([
        portalTwoGeohash,
        geohashNeighbour(portalTwoGeohash, "e"),
        geohashNeighbour(portalTwoGeohash, "s"),
        geohashNeighbour(portalTwoGeohash, "se"),
    ]);

    // Test initial attributes
    let portalOneAttributes = itemAttibutes(portalOne);
    let portalTwoAttributes = itemAttibutes(portalTwo);
    expect(portalOneAttributes).toMatchObject({
        destructible: false,
        description: "Portal One. It is tuned to teleport to .",
        variant: "default",
    });
    expect(portalTwoAttributes).toMatchObject({
        destructible: false,
        description: "Portal Two. It is tuned to teleport to .",
        variant: "default",
    });
});

beforeEach(async () => {
    // Reset entities locations
    playerOne.loc = [portalOne.loc[0]];
    playerOne.locT = "geohash";
    playerOne.locI = LOCATION_INSTANCE;
    playerOne = await saveEntity(playerOne);

    playerTwo.loc = [portalTwo.loc[0]];
    playerTwo.locT = "geohash";
    playerTwo.locI = LOCATION_INSTANCE;
    playerTwo = await saveEntity(playerTwo);

    playerThree.loc = [woodenDoor.loc[0]];
    playerThree.locT = "geohash";
    playerThree.locI = LOCATION_INSTANCE;
    playerThree = await saveEntity(playerThree);
});

describe("Test Items", () => {
    test("Test Enter Item", async () => {
        // Move playerOne to tavern
        playerOne.loc = [tavern.loc[0]];
        playerOne.locT = tavern.locT;
        playerOne.locI = tavern.locI;
        playerOne = await saveEntity(playerOne);

        // Test prop as world attribute
        expect(compendium[tavern.prop].world != null).toBe(true);

        // Test variable substitution
        const propWorld = substituteValues(
            compendium[tavern.prop].world as any,
            {
                ...tavern.vars,
                self: tavern,
            },
        );
        expect(propWorld).toMatchObject({
            locationInstance: tavern.item, // use tavern.item as the locationInstance
            locationType: "in",
            geohash: tavern.loc[0],
            world: tavern.item, // use tavern.item as the unique worldId
            url: worldAssetUrl,
        });

        // playerOne enter tavern
        const { player: playerAfter, pois } = await enterItem(
            playerOne,
            tavern.item,
        );

        // Check player spawn point
        const spawnPoint = pois.find(
            (p) => "spawn" in p && p.spawn === "player",
        );
        if (spawnPoint) {
            expect(playerAfter.loc[0]).toBe(spawnPoint.geohash);
        }
        // Check player location is inside the tavern (if no spawn point)
        else {
            expect(playerAfter.loc[0]).toBe(tavern.loc[0]);
        }
        expect(playerAfter).toMatchObject({
            locT: propWorld.locationType,
            locI: propWorld.locationInstance,
        });
    });

    test("Test Spawn", async () => {
        // Test cannot spawn item on collider
        await expect(
            spawnItemAtGeohash({
                geohash: woodenDoor.loc[0],
                locationType: "geohash",
                locationInstance: LOCATION_INSTANCE,
                prop: compendium.woodendoor.prop,
            }),
        ).rejects.toThrowError(
            `Cannot spawn ${compendium.woodendoor.prop} at ${woodenDoor.loc[0]}`,
        );
    });

    test("Test Configuration", async () => {
        // Configure woodenDoor
        woodenDoor = await configureItem(playerThree, woodenDoor.item, {
            [compendium.woodendoor.variables!.doorsign.variable]:
                "A custom door sign",
        });
        expect(woodenDoor).toMatchObject({
            name: compendium.woodendoor.defaultName,
            prop: compendium.woodendoor.prop,
            locT: "geohash",
            dur: compendium.woodendoor.durability,
            chg: compendium.woodendoor.charges,
            state: compendium.woodendoor.defaultState,
            dbuf: [],
            buf: [],
        });
        expect(woodenDoor.vars).toMatchObject({
            [compendium.woodendoor.variables!.doorsign.variable]:
                "A custom door sign",
        });

        // Test item configuration (via variables)
        const attributes = itemAttibutes(woodenDoor);
        expect(attributes).toMatchObject({
            destructible: false,
            description: "A custom door sign. The door is closed.",
            variant: "closed",
        });

        // Configure portalOne to point to portalTwo
        portalOne = await configureItem(
            playerOne as PlayerEntity,
            portalOne.item,
            {
                [compendium.portal.variables!.target.variable]: portalTwo.item,
            },
        );

        // Configure portalTwo to point to portalOne
        portalTwo = await configureItem(
            playerTwo as PlayerEntity,
            portalTwo.item,
            {
                [compendium.portal.variables!.target.variable]: portalOne.item,
            },
        );
        expect(itemAttibutes(portalOne)).toMatchObject({
            destructible: false,
            description: `Portal One. It is tuned to teleport to ${portalTwo.item}.`,
            variant: "default",
        });
        expect(itemAttibutes(portalTwo)).toMatchObject({
            destructible: false,
            description: `Portal Two. It is tuned to teleport to ${portalOne.item}.`,
            variant: "default",
        });

        // Test `itemVariableValue`
        const portalOneTarget = await itemVariableValue(portalOne, "target");
        expect(portalOneTarget).toMatchObject(portalTwo);
    });

    test("Test Use Item", async () => {
        // Open door
        await useItem({
            item: woodenDoor.item,
            utility: compendium[woodenDoor.prop].utilities.open.utility,
            self: playerThree as PlayerEntity,
        });
        await sleep(MS_PER_TICK * 2); // wait for item to be updated
        woodenDoor = (await fetchEntity(woodenDoor.item)) as ItemEntity;
        expect(woodenDoor).toMatchObject({ state: "open" });

        // Close door
        await useItem({
            item: woodenDoor.item,
            utility: compendium[woodenDoor.prop].utilities.close.utility,
            self: playerThree as PlayerEntity,
        });
        await sleep(MS_PER_TICK * 2); // wait for item to be updated
        woodenDoor = (await fetchEntity(woodenDoor.item)) as ItemEntity;
        expect(woodenDoor).toMatchObject({
            state: "closed",
        });

        // playerOne use portalOne to teleport to portalTwo
        const portalOneBefore = cloneDeep(portalOne);
        expect(playerOne.loc[0] === portalTwo.loc[0]).toBe(false);
        await useItem({
            item: portalOne.item,
            utility: compendium.portal.utilities.teleport.utility,
            self: playerOne as PlayerEntity,
        });
        await sleep(MS_PER_TICK * 2); // wait for item to be updated
        portalOne = (await fetchEntity(portalOne.item)) as ItemEntity;
        playerOne = (await fetchEntity(playerOne.player)) as PlayerEntity;
        expect(portalOne.chg).toBe(
            portalOneBefore.chg -
                compendium.portal.utilities.teleport.cost.charges,
        );
        expect(portalOne.dur).toBe(
            portalOneBefore.dur -
                compendium.portal.utilities.teleport.cost.durability,
        );
        expect(playerOne.loc[0] === portalTwo.loc[0]).toBe(true);
    });

    test("Test Take Item", async () => {
        playerOne.loc = [portalTwo.loc[0]];
        playerOne = (await saveEntity(playerOne)) as PlayerEntity;

        // Test taking item which is untakeable
        await expect(takeItem(playerOne, portalTwo.item)).rejects.toThrowError(
            `${portalTwo.item} cannot be taken`,
        );
    });

    test("Test Take/Equip/Use", async () => {
        let playerOneWoodenClub = await spawnItemAtGeohash({
            geohash: playerOne.loc[0],
            locationType: "geohash",
            locationInstance: LOCATION_INSTANCE,
            prop: compendium.woodenclub.prop,
            owner: playerOne.player,
            configOwner: playerOne.player,
        });

        // playerOne take playerOneWoodenClub
        playerOneWoodenClub = await takeItem(
            playerOne,
            playerOneWoodenClub.item,
        );

        // playerOne cannot use playerOneWoodenClub without equipping
        var error = `${playerOneWoodenClub.item} is not equipped in the required slot`;
        await expect(
            useItem({
                item: playerOneWoodenClub.item,
                utility: compendium.woodenclub.utilities.swing.utility,
                self: playerOne as PlayerEntity,
                target: playerTwo.player,
            }),
        ).rejects.toThrowError(error);
        await expect(
            waitForEventData(playerOneStream, "feed"),
        ).resolves.toMatchObject({
            type: "error",
            message: error,
        });

        // playerOne equip playerOneWoodenClub
        playerOneWoodenClub = await equipItem(
            playerOne,
            playerOneWoodenClub.item,
            "rh",
        );
        await sleep(MS_PER_TICK * 2);

        // playerOne swing playerOneWoodenClub at playerTwo (target out of range)
        playerOneWoodenClub = await useItem({
            item: playerOneWoodenClub.item,
            utility: compendium.woodenclub.utilities.swing.utility,
            self: playerOne as PlayerEntity,
            target: playerTwo.player,
        });
        await expect(
            waitForEventData(playerOneStream, "feed"),
        ).resolves.toMatchObject({
            type: "error",
            message: "Target is out of range",
        });

        // playerOne swing playerOneWoodenClub at playerTwo (successful)
        playerOne.loc = playerTwo.loc;
        playerOne = (await saveEntity(playerOne)) as PlayerEntity;
        await testPlayerUseItemOnPlayer({
            self: playerOne,
            target: playerTwo,
            item: playerOneWoodenClub,
            utility: compendium.woodenclub.utilities.swing.utility,
            selfCookies: playerOneCookies,
            targetStream: playerTwoStream,
            selfStream: playerOneStream,
        });
    });

    test("Test Item Permissions (Negative)", async () => {
        let playerOneWoodenClub = await spawnItemAtGeohash({
            geohash: playerTwo.loc[0], // spawn at playerTwo
            locationType: "geohash",
            locationInstance: LOCATION_INSTANCE,
            prop: compendium.woodenclub.prop,
            owner: playerOne.player,
            configOwner: playerOne.player,
        });

        // playerTwo use playerOneWoodenClub (negative permissions)
        var error = `${playerTwo.player} does not own ${playerOneWoodenClub.item}`;
        await expect(
            useItem({
                item: playerOneWoodenClub.item,
                utility: compendium.woodenclub.utilities.swing.utility,
                self: playerTwo as PlayerEntity,
                target: playerOne.player,
            }),
        ).rejects.toThrowError(error);
        await expect(
            waitForEventData(playerTwoStream, "feed"),
        ).resolves.toMatchObject({
            type: "error",
            message: error,
        });

        // playerTwo configure playerOneWoodenClub (negative config permissions)
        await expect(
            configureItem(playerTwo as PlayerEntity, playerOneWoodenClub.item, {
                [compendium.woodenclub.variables.etching.variable]:
                    "playerTwo's etching",
            }),
        ).rejects.toThrowError(
            `${playerTwo.player} does not own ${playerOneWoodenClub.item}`,
        );
    });

    test("Test Item Permissions", async () => {
        let playerOneWoodenClub = await spawnItemAtGeohash({
            geohash: playerOne.loc[0],
            locationType: "geohash",
            locationInstance: LOCATION_INSTANCE,
            prop: compendium.woodenclub.prop,
            owner: playerOne.player,
            configOwner: playerOne.player,
        });

        // playerOne configure playerOneWoodenClub
        playerOneWoodenClub = await configureItem(
            playerOne as PlayerEntity,
            playerOneWoodenClub.item,
            {
                [compendium.woodenclub.variables.etching.variable]:
                    "An etching",
            },
        );
        expect(itemAttibutes(playerOneWoodenClub)).toMatchObject({
            destructible: true,
            description: "A simple wooden club. An etching",
            variant: "default",
        });

        // playerOne configure woodendoor (public permissions)
        playerOne.loc = [woodenDoor.loc[0]];
        playerOne = (await saveEntity(playerOne)) as PlayerEntity;
        woodenDoor = await configureItem(
            playerOne as PlayerEntity,
            woodenDoor.item,
            {
                [compendium.woodendoor.variables!.doorsign.variable]:
                    "A public door sign",
            },
        );
        expect(woodenDoor).toMatchObject({
            vars: { doorsign: "A public door sign" },
        });
    });
});
