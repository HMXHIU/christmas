import { crossoverCmdEquip, crossoverCmdTake } from "$lib/crossover";
import { geohashNeighbour } from "$lib/crossover/utils";
import { itemAttibutes } from "$lib/crossover/world/compendium";
import { compendium } from "$lib/crossover/world/settings";
import {
    configureItem,
    itemVariableValue,
    spawnItem,
    useItem,
} from "$lib/server/crossover";
import type {
    ItemEntity,
    PlayerEntity,
} from "$lib/server/crossover/redis/entities";
import { sleep } from "$lib/utils";
import { expect, test } from "vitest";
import { getRandomRegion } from "../utils";
import { createRandomPlayer, generateRandomGeohash } from "./utils";

test("Test Items", async () => {
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

    // Test cannot spawn item on collider
    await sleep(200); // why need to wait for item to be indexed ???
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
    const woodendoorProp = compendium[woodendoor.prop];
    const { item: openedWoodenDoor } = await useItem({
        item: woodendoor,
        utility: woodendoorProp.utilities.open.utility,
        self: playerOne as PlayerEntity,
    });

    // Test state change
    expect(openedWoodenDoor).toMatchObject({
        state: "open",
    });
    const { item: closedWoodenDoor } = await useItem({
        item: openedWoodenDoor,
        utility: woodendoorProp.utilities.close.utility,
        self: playerOne as PlayerEntity,
    });
    expect(closedWoodenDoor).toMatchObject({
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
    portalOne = (
        await configureItem({
            self: playerOne as PlayerEntity,
            item: portalOne,
            variables: {
                [compendium.portal.variables!.target.variable]: portalTwo.item,
            },
        })
    ).item;
    portalTwo = (
        await configureItem({
            self: playerTwo as PlayerEntity,
            item: portalTwo,
            variables: {
                [compendium.portal.variables!.target.variable]: portalOne.item,
            },
        })
    ).item;
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

    const beforeCharges = portalOne.chg;
    const beforeDurability = portalOne.dur;
    expect(playerOne.loc[0] === portalTwo.loc[0]).toBe(false);
    let itemResult = await useItem({
        item: portalOne,
        utility: compendium.portal.utilities.teleport.utility,
        self: playerOne as PlayerEntity,
    });
    portalOne = itemResult.item;
    playerOne = itemResult.self as PlayerEntity;

    expect(portalOne.chg).toBe(
        beforeCharges - compendium.portal.utilities.teleport.cost.charges,
    );
    expect(portalOne.dur).toBe(
        beforeDurability - compendium.portal.utilities.teleport.cost.durability,
    );
    expect(playerOne.loc[0] === portalTwo.loc[0]).toBe(true);

    /*
     * Test taking item which is untakeable
     */

    await expect(
        crossoverCmdTake(
            { item: portalTwo.item },
            { Cookie: playerOneCookies },
        ),
    ).resolves.toMatchObject({
        status: "failure",
        message: `${portalTwo.item} cannot be taken`,
    });

    /*
     * Test item permissions
     */

    // Test owner permissions
    let playerOneWoodenClub = await spawnItem({
        geohash: playerOne.loc[0],
        prop: compendium.woodenclub.prop,
        owner: playerOne.player,
        configOwner: playerOne.player,
    });

    // Take item
    playerOneWoodenClub = (
        await crossoverCmdTake(
            { item: playerOneWoodenClub.item },
            { Cookie: playerOneCookies },
        )
    ).items?.[0]!;

    // Test cannot use item without equipping
    var { status, message } = await useItem({
        item: playerOneWoodenClub,
        utility: compendium.woodenclub.utilities.swing.utility,
        self: playerOne as PlayerEntity,
        target: playerTwo as PlayerEntity,
    });
    expect(status).toBe("failure");
    expect(message).toBe(
        `${playerOneWoodenClub.item} is not equipped in the required slot`,
    );

    // Equip item
    playerOneWoodenClub = (
        await crossoverCmdEquip(
            {
                item: playerOneWoodenClub.item,
                slot: "rh",
            },
            { Cookie: playerOneCookies },
        )
    ).items?.[0]!;

    // Test target out of range
    var { status, message } = await useItem({
        item: playerOneWoodenClub,
        utility: compendium.woodenclub.utilities.swing.utility,
        self: playerOne as PlayerEntity,
        target: playerTwo as PlayerEntity,
    });
    expect(status).toBe("failure");
    expect(message).toBe("Target is out of range");

    // Test in range and have permissions
    playerTwo.loc[0] = playerOne.loc[0];
    await expect(
        useItem({
            item: playerOneWoodenClub,
            utility: compendium.woodenclub.utilities.swing.utility,
            self: playerOne as PlayerEntity,
            target: playerTwo as PlayerEntity,
        }),
    ).resolves.toMatchObject({
        item: {
            own: playerOne.player,
            cfg: playerOne.player,
            dur: 99,
            chg: 0,
        },
        target: {
            player: playerTwo.player,
            hp: 9, // take one damage
        },
        self: {
            player: playerOne.player,
            ap: 4, // item uses charges instead of user's resources
            st: 10, // item uses charges instead of user's resources
        },
        status: "success",
        message: "",
    });

    // Test negative permissions
    var { status, message } = await useItem({
        item: playerOneWoodenClub,
        utility: compendium.woodenclub.utilities.swing.utility,
        self: playerTwo as PlayerEntity,
        target: playerOne as PlayerEntity,
    });
    expect(status).toBe("failure");
    expect(message).toBe(
        `${playerTwo.player} does not own ${playerOneWoodenClub.item}`,
    );

    // Test config permissions
    playerOneWoodenClub = (
        await configureItem({
            self: playerOne as PlayerEntity,
            item: playerOneWoodenClub,
            variables: {
                [compendium.woodenclub.variables.etching.variable]:
                    "An etching",
            },
        })
    ).item;
    expect(itemAttibutes(playerOneWoodenClub)).toMatchObject({
        destructible: true,
        description: "A simple wooden club An etching.",
        variant: "default",
    });

    // Test negative config permissions
    var { status, message } = await configureItem({
        self: playerTwo as PlayerEntity,
        item: playerOneWoodenClub,
        variables: {
            [compendium.woodenclub.variables.etching.variable]:
                "playerTwo's etching",
        },
    });
    expect(status).toBe("failure");
    expect(message).toBe(
        `${playerTwo.player} does not own ${playerOneWoodenClub.item}`,
    );

    // Test config public item
    woodendoor = (
        await configureItem({
            self: playerOne as PlayerEntity,
            item: woodendoor,
            variables: {
                [compendium.woodendoor.variables!.doorsign.variable]:
                    "A public door sign",
            },
        })
    ).item;
    expect(woodendoor).toMatchObject({
        vars: { doorsign: "A public door sign" },
    });
});
