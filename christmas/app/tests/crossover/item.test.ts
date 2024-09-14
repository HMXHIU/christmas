import { geohashNeighbour } from "$lib/crossover/utils";
import { itemAttibutes } from "$lib/crossover/world/compendium";
import { LOCATION_INSTANCE, MS_PER_TICK } from "$lib/crossover/world/settings";
import { compendium } from "$lib/crossover/world/settings/compendium";
import type { WorldAssetMetadata } from "$lib/crossover/world/types";
import {
    configureItem,
    enterItem,
    equipItem,
    takeItem,
    useItem,
} from "$lib/server/crossover/actions/item";
import { spawnItemAtGeohash } from "$lib/server/crossover/dungeonMaster";
import {
    fetchEntity,
    initializeClients,
    saveEntity,
} from "$lib/server/crossover/redis";
import type {
    ItemEntity,
    PlayerEntity,
} from "$lib/server/crossover/redis/entities";
import { itemVariableValue } from "$lib/server/crossover/utils";
import { sleep, substituteValues } from "$lib/utils";
import type NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { cloneDeep } from "lodash";
import { beforeAll, beforeEach, describe, expect, test } from "vitest";
import {
    createGandalfSarumanSauron,
    createWorldAsset,
    generateRandomGeohash,
    testPlayerUseItemOnPlayer,
    waitForEventData,
} from "./utils";

let region: string;
let geohash: string;
let playerOne: PlayerEntity;
let playerTwo: PlayerEntity;
let playerThree: PlayerEntity;
let playerOneCookies: string;
let playerTwoCookies: string;
let playerThreeCookies: string;
let playerOneStream: EventTarget;
let playerTwoStream: EventTarget;
let playerThreeStream: EventTarget;
let playerOneWallet: NodeWallet;
let playerTwoWallet: NodeWallet;
let playerThreeWallet: NodeWallet;

let woodenDoor: ItemEntity;
let woodenDoorGeohash: string;

let portalOne: ItemEntity;
let portalTwo: ItemEntity;
let portalTwoGeohash: string;
let playerOneGeohash: string;
let tavern: ItemEntity;
let tavernGeohash: string;

let worldAssetUrl: string;
let worldAsset: WorldAssetMetadata;

let playerOneWoodenClub: ItemEntity;

beforeAll(async () => {
    await initializeClients(); // create redis repositories
    ({
        region,
        geohash: playerOneGeohash,
        playerOne,
        playerTwo,
        playerThree,
        playerOneCookies,
        playerTwoCookies,
        playerThreeCookies,
        playerOneStream,
        playerTwoStream,
        playerThreeStream,
        playerOneWallet,
        playerTwoWallet,
        playerThreeWallet,
    } = await createGandalfSarumanSauron());

    // Test spawn wooden door at random location
    woodenDoorGeohash = generateRandomGeohash(8, "h9");
    woodenDoor = (await spawnItemAtGeohash({
        geohash: woodenDoorGeohash,
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        prop: compendium.woodendoor.prop,
        variables: {
            [compendium.woodendoor.variables!.doorsign.variable]:
                "A custom door sign",
        },
    })) as ItemEntity;
    expect(woodenDoor).toMatchObject({
        name: compendium.woodendoor.defaultName,
        prop: compendium.woodendoor.prop,
        loc: [woodenDoorGeohash],
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

    // Spawn portalOne at playerOne location
    portalOne = (await spawnItemAtGeohash({
        geohash: playerOneGeohash,
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        prop: compendium.portal.prop,
        variables: {
            [compendium.portal.variables!.description.variable]: "Portal One",
        },
    })) as ItemEntity;

    // Spawn portalTwo at playerTwo location
    portalTwoGeohash = generateRandomGeohash(8, "h9");
    portalTwo = (await spawnItemAtGeohash({
        geohash: portalTwoGeohash, // somwhere else
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        prop: compendium.portal.prop,
        variables: {
            [compendium.portal.variables!.description.variable]: "Portal Two",
        },
    })) as ItemEntity;
    playerTwo.loc[0] = portalTwoGeohash;
    playerTwo = (await saveEntity(playerTwo)) as PlayerEntity;

    // Test item location (more than 1 cell)
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

    // Spawn playerOneWoodenClub with owner as playerOne
    playerOneWoodenClub = await spawnItemAtGeohash({
        geohash: playerOne.loc[0],
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        prop: compendium.woodenclub.prop,
        owner: playerOne.player,
        configOwner: playerOne.player,
    });

    // Spawn tavern
    tavernGeohash = generateRandomGeohash(8, "h9");
    const asset = await createWorldAsset();
    worldAsset = asset.asset;
    worldAssetUrl = asset.url;

    tavern = (await spawnItemAtGeohash({
        geohash: tavernGeohash,
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        prop: compendium.tavern.prop,
        variables: {
            url: worldAssetUrl,
        },
    })) as ItemEntity;
});

beforeEach(async () => {
    // Reset playerOne location
    playerOne.loc = [playerOneGeohash];
    playerOne.locT = "geohash";
    playerOne.locI = LOCATION_INSTANCE;
    playerOne = (await saveEntity(playerOne)) as PlayerEntity;
});

describe("Test Items", () => {
    test("Test Enter Item", async () => {
        // Move playerOne to tavern
        playerOne.loc = [tavernGeohash];
        playerOne.locT = tavern.locT;
        playerOne.locI = tavern.locI;
        playerOne = (await saveEntity(playerOne)) as PlayerEntity;

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
                geohash: woodenDoorGeohash,
                locationType: "geohash",
                locationInstance: LOCATION_INSTANCE,
                prop: compendium.woodendoor.prop,
            }),
        ).rejects.toThrowError(
            `Cannot spawn ${compendium.woodendoor.prop} at ${woodenDoorGeohash}`,
        );
    });

    test("Test Configuration", async () => {
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
            self: playerOne as PlayerEntity,
        });
        await sleep(MS_PER_TICK * 2); // wait for item to be updated
        woodenDoor = (await fetchEntity(woodenDoor.item)) as ItemEntity;
        expect(woodenDoor).toMatchObject({ state: "open" });

        // Close door
        await useItem({
            item: woodenDoor.item,
            utility: compendium[woodenDoor.prop].utilities.close.utility,
            self: playerOne as PlayerEntity,
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

    test("Test Item Permissions", async () => {
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

        // playerTwo configure playerOneOtherWoodenClub (negative config permissions)
        let playerOneOtherWoodenClub = await spawnItemAtGeohash({
            geohash: playerTwo.loc[0],
            locationType: "geohash",
            locationInstance: LOCATION_INSTANCE,
            prop: compendium.woodenclub.prop,
            owner: playerOne.player,
            configOwner: playerOne.player,
        });
        await expect(
            configureItem(
                playerTwo as PlayerEntity,
                playerOneOtherWoodenClub.item,
                {
                    [compendium.woodenclub.variables.etching.variable]:
                        "playerTwo's etching",
                },
            ),
        ).rejects.toThrowError(
            `${playerTwo.player} does not own ${playerOneOtherWoodenClub.item}`,
        );

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
