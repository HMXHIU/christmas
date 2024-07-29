import { crossoverCmdEquip, crossoverCmdTake, stream } from "$lib/crossover";
import { geohashNeighbour } from "$lib/crossover/utils";
import { compendium, itemAttibutes } from "$lib/crossover/world/compendium";
import { MS_PER_TICK } from "$lib/crossover/world/settings";
import { configureItem, useItem } from "$lib/server/crossover/actions";
import { spawnItem } from "$lib/server/crossover/dungeonMaster";
import { fetchEntity, initializeClients } from "$lib/server/crossover/redis";
import type {
    ItemEntity,
    PlayerEntity,
} from "$lib/server/crossover/redis/entities";
import { itemVariableValue } from "$lib/server/crossover/utils";
import { sleep } from "$lib/utils";
import { cloneDeep } from "lodash";
import { expect, test } from "vitest";
import { getRandomRegion } from "../utils";
import {
    createRandomPlayer,
    flushEventChannel,
    generateRandomGeohash,
    waitForEventData,
} from "./utils";

test("Test Items", async () => {
    await initializeClients(); // create redis repositories
    const region = String.fromCharCode(...getRandomRegion());

    // Player one
    const playerOneName = "Gandalf";
    const playerOneGeohash = generateRandomGeohash(8, "h9");
    let [playerOneWallet, playerOneCookies, playerOne] =
        await createRandomPlayer({
            region,
            geohash: playerOneGeohash,
            name: playerOneName,
        });

    // Player two
    const playerTwoName = "Saruman";
    const playerTwoGeohash = generateRandomGeohash(8, "h9");
    let [playerTwoWallet, playerTwoCookies, playerTwo] =
        await createRandomPlayer({
            region,
            geohash: playerTwoGeohash,
            name: playerTwoName,
        });

    // Create streams
    const [playerOneStream, playerOneCloseStream] = await stream({
        Cookie: playerOneCookies,
    });
    await expect(
        waitForEventData(playerOneStream, "feed"),
    ).resolves.toMatchObject({
        type: "system",
        message: "started",
    });
    const [playerTwoStream, playerTwoCloseStream] = await stream({
        Cookie: playerTwoCookies,
    });
    await expect(
        waitForEventData(playerTwoStream, "feed"),
    ).resolves.toMatchObject({
        type: "system",
        message: "started",
    });

    /*
     * Test spawn item
     */

    // Spawn wooden door at random location
    const woodendoorGeohash = generateRandomGeohash(8, "h9");
    let woodendoor = (await spawnItem({
        geohash: woodendoorGeohash,
        prop: compendium.woodendoor.prop,
        variables: {
            [compendium.woodendoor.variables!.doorsign.variable]:
                "A custom door sign",
        },
    })) as ItemEntity;
    expect(woodendoor).toMatchObject({
        name: compendium.woodendoor.defaultName,
        prop: compendium.woodendoor.prop,
        loc: [woodendoorGeohash],
        locT: "geohash",
        dur: compendium.woodendoor.durability,
        chg: compendium.woodendoor.charges,
        state: compendium.woodendoor.defaultState,
        dbuf: [],
        buf: [],
    });
    expect(woodendoor.vars).toMatchObject({
        [compendium.woodendoor.variables!.doorsign.variable]:
            "A custom door sign",
    });
    await sleep(MS_PER_TICK * 2); // wait for item to be spanwed

    // Test cannot spawn item on collider
    await expect(
        spawnItem({
            geohash: woodendoorGeohash,
            prop: compendium.woodendoor.prop,
        }),
    ).rejects.toThrowError(
        `Cannot spawn ${compendium.woodendoor.prop} at ${woodendoorGeohash}`,
    );

    /*
     * Test item configuration (via variables)
     */
    const attributes = itemAttibutes(woodendoor);
    expect(attributes).toMatchObject({
        destructible: false,
        description: "A custom door sign. The door is closed.",
        variant: "closed",
    });

    /*
     * Test `useItem`
     */

    // Open door
    await useItem({
        item: woodendoor.item,
        utility: compendium[woodendoor.prop].utilities.open.utility,
        self: playerOne as PlayerEntity,
    });
    await sleep(MS_PER_TICK * 2); // wait for item to be updated
    woodendoor = (await fetchEntity(woodendoor.item)) as ItemEntity;
    expect(woodendoor).toMatchObject({ state: "open" });

    // Close door
    await useItem({
        item: woodendoor.item,
        utility: compendium[woodendoor.prop].utilities.close.utility,
        self: playerOne as PlayerEntity,
    });
    await sleep(MS_PER_TICK * 2); // wait for item to be updated
    woodendoor = (await fetchEntity(woodendoor.item)) as ItemEntity;
    expect(woodendoor).toMatchObject({
        state: "closed",
    });

    /*
     * Test `configureItem`
     */

    // Spawn portalOne at playerOne location
    let portalOne = (await spawnItem({
        geohash: playerOneGeohash,
        prop: compendium.portal.prop,
        variables: {
            [compendium.portal.variables!.description.variable]: "Portal One",
        },
    })) as ItemEntity;
    await sleep(MS_PER_TICK * 2); // wait for item to be updated

    // Spawn portalTwo at random location
    const portalTwoGeohash = generateRandomGeohash(8, "h9");
    let portalTwo = (await spawnItem({
        geohash: portalTwoGeohash, // somwhere else
        prop: compendium.portal.prop,
        variables: {
            [compendium.portal.variables!.description.variable]: "Portal Two",
        },
    })) as ItemEntity;

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
        description: "Portal One. It is tuned to teleport to ${target}.",
        variant: "default",
    });
    expect(portalTwoAttributes).toMatchObject({
        destructible: false,
        description: "Portal Two. It is tuned to teleport to ${target}.",
        variant: "default",
    });

    // Test changing variables
    await configureItem(playerOne as PlayerEntity, portalOne.item, {
        [compendium.portal.variables!.target.variable]: portalTwo.item,
    });
    portalOne = (await fetchEntity(portalOne.item)) as ItemEntity;
    portalTwo = await configureItem(playerTwo as PlayerEntity, portalTwo.item, {
        [compendium.portal.variables!.target.variable]: portalOne.item,
    });
    portalOneAttributes = itemAttibutes(portalOne);
    portalTwoAttributes = itemAttibutes(portalTwo);
    expect(portalOneAttributes).toMatchObject({
        destructible: false,
        description: `Portal One. It is tuned to teleport to ${portalTwo.item}.`,
        variant: "default",
    });
    expect(portalTwoAttributes).toMatchObject({
        destructible: false,
        description: `Portal Two. It is tuned to teleport to ${portalOne.item}.`,
        variant: "default",
    });

    // Test `itemVariableValue`
    const portalOneTarget = await itemVariableValue(portalOne, "target");
    expect(portalOneTarget).toMatchObject(portalTwo);

    /*
     * Test using item ability
     */

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
        portalOneBefore.chg - compendium.portal.utilities.teleport.cost.charges,
    );
    expect(portalOne.dur).toBe(
        portalOneBefore.dur -
            compendium.portal.utilities.teleport.cost.durability,
    );
    expect(playerOne.loc[0] === portalTwo.loc[0]).toBe(true);

    /*
     * Test taking item which is untakeable
     */

    await crossoverCmdTake(
        { item: portalTwo.item },
        { Cookie: playerOneCookies },
    );
    await expect(
        waitForEventData(playerOneStream, "feed"),
    ).resolves.toMatchObject({
        type: "error",
        message: `${portalTwo.item} cannot be taken`,
    });
    await sleep(MS_PER_TICK * 2); // wait for item to be updated

    /*
     * Test item permissions
     */
    await flushEventChannel(playerOneStream, "feed");
    await flushEventChannel(playerOneStream, "entities");
    await sleep(MS_PER_TICK * 4); // wait for flush

    // Test owner permissions
    let playerOneWoodenClub = await spawnItem({
        geohash: playerOne.loc[0],
        prop: compendium.woodenclub.prop,
        owner: playerOne.player,
        configOwner: playerOne.player,
    });

    // Take item
    await crossoverCmdTake(
        { item: playerOneWoodenClub.item },
        { Cookie: playerOneCookies },
    );
    await sleep(MS_PER_TICK * 2); // wait for item to be updated
    playerOneWoodenClub = (await fetchEntity(
        playerOneWoodenClub.item,
    )) as ItemEntity;

    // Test cannot use item without equipping
    await useItem({
        item: playerOneWoodenClub.item,
        utility: compendium.woodenclub.utilities.swing.utility,
        self: playerOne as PlayerEntity,
        target: playerTwo.player,
    });
    await expect(
        waitForEventData(playerOneStream, "feed"),
    ).resolves.toMatchObject({
        type: "error",
        message: `${playerOneWoodenClub.item} is not equipped in the required slot`,
    });

    // Equip item
    await crossoverCmdEquip(
        {
            item: playerOneWoodenClub.item,
            slot: "rh",
        },
        { Cookie: playerOneCookies },
    );
    await sleep(MS_PER_TICK * 2); // wait for item to be updated
    playerOneWoodenClub = (await fetchEntity(
        playerOneWoodenClub.item,
    )) as ItemEntity;

    // Test target out of range
    await useItem({
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

    // Test in range and have permissions
    playerTwo.loc[0] = playerOne.loc[0];
    await useItem({
        item: playerOneWoodenClub.item,
        utility: compendium.woodenclub.utilities.swing.utility,
        self: playerOne as PlayerEntity,
        target: playerTwo.player,
    });

    await expect(
        waitForEventData(playerOneStream, "entities"),
    ).resolves.toMatchObject({
        event: "entities",
        players: [
            {
                player: playerOne.player,
                ap: 4, // item uses charges instead of user's resources
                st: 10, // item uses charges instead of user's resources
            },
            {
                player: playerTwo.player,
                hp: 9, // take one damage
            },
        ],
        monsters: [],
        items: [],
        op: "upsert",
    });
    await expect(
        waitForEventData(playerOneStream, "entities"),
    ).resolves.toMatchObject({
        event: "entities",
        players: [
            {
                player: playerOne.player,
            },
        ],
        monsters: [],
        items: [
            {
                item: playerOneWoodenClub.item,
                dur: 99,
                chg: 0,
                state: "default",
            },
        ],
        op: "upsert",
    });
    await sleep(MS_PER_TICK * 2); // wait for item to be updated
    playerOneWoodenClub = (await fetchEntity(
        playerOneWoodenClub.item,
    )) as ItemEntity;

    // Test negative permissions
    await useItem({
        item: playerOneWoodenClub.item,
        utility: compendium.woodenclub.utilities.swing.utility,
        self: playerTwo as PlayerEntity,
        target: playerOne.player,
    });
    await expect(
        waitForEventData(playerTwoStream, "feed"),
    ).resolves.toMatchObject({
        type: "error",
        message: `${playerTwo.player} does not own ${playerOneWoodenClub.item}`,
    });

    // Test config permissions
    playerOneWoodenClub = await configureItem(
        playerOne as PlayerEntity,
        playerOneWoodenClub.item,
        {
            [compendium.woodenclub.variables.etching.variable]: "An etching",
        },
    );
    expect(itemAttibutes(playerOneWoodenClub)).toMatchObject({
        destructible: true,
        description: "A simple wooden club An etching.",
        variant: "default",
    });

    // Test negative config permissions
    expect(
        configureItem(playerTwo as PlayerEntity, playerOneWoodenClub.item, {
            [compendium.woodenclub.variables.etching.variable]:
                "playerTwo's etching",
        }),
    ).rejects.toThrowError(
        `${playerTwo.player} does not own ${playerOneWoodenClub.item}`,
    );

    // Test config public item
    woodendoor = await configureItem(
        playerOne as PlayerEntity,
        woodendoor.item,
        {
            [compendium.woodendoor.variables!.doorsign.variable]:
                "A public door sign",
        },
    );
    expect(woodendoor).toMatchObject({
        vars: { doorsign: "A public door sign" },
    });
});
