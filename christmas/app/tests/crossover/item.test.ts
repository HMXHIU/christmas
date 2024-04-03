import { commandTakeItem, equipItem } from "$lib/crossover";
import { itemAttibutes } from "$lib/crossover/world/compendium";
import { compendium } from "$lib/crossover/world/settings";
import {
    configureItem,
    itemVariableValue,
    spawnItem,
    updatedItemVariables,
    useItem,
} from "$lib/server/crossover";
import type {
    ItemEntity,
    PlayerEntity,
} from "$lib/server/crossover/redis/entities";
import { expect, test } from "vitest";
import { getRandomRegion } from "../utils";
import { createRandomPlayer } from "./utils";

test("Test Items", async () => {
    const geohash = "w21z3we7";
    const region = String.fromCharCode(...getRandomRegion());

    // Player one
    const playerOneName = "Gandalf";
    const playerOneGeohash = "gbsuv7";
    let [playerOneWallet, playerOneCookies, playerOne] =
        await createRandomPlayer({
            region,
            geohash: playerOneGeohash,
            name: playerOneName,
        });

    // Player two
    const playerTwoName = "Saruman";
    const playerTwoGeohash = "gbsuv8";
    let [playerTwoWallet, playerTwoCookies, playerTwo] =
        await createRandomPlayer({
            region,
            geohash: playerTwoGeohash,
            name: playerTwoName,
        });

    /*
     * Test spawn item
     */
    let woodenDoor = (await spawnItem({
        geohash,
        prop: compendium.woodenDoor.prop,
        variables: {
            [compendium.woodenDoor.variables!.doorSign.variable]:
                "A custom door sign",
        },
    })) as ItemEntity;
    expect(woodenDoor).toMatchObject({
        name: compendium.woodenDoor.defaultName,
        prop: compendium.woodenDoor.prop,
        location: [geohash],
        locationType: "geohash",
        durability: compendium.woodenDoor.durability,
        charges: compendium.woodenDoor.charges,
        state: compendium.woodenDoor.defaultState,
        debuffs: [],
        buffs: [],
    });
    expect(JSON.parse(woodenDoor.variables)).toMatchObject({
        [compendium.woodenDoor.variables!.doorSign.variable]:
            "A custom door sign",
    });

    /*
     * Test item configuration (via variables)
     */
    const attributes = itemAttibutes(woodenDoor);
    expect(attributes).toMatchObject({
        traversable: 0,
        destructible: false,
        description: "A custom door sign. The door is closed.",
        variant: "closed",
    });

    /*
     * Test `useItem`
     */
    const woodenDoorProp = compendium[woodenDoor.prop];
    const { item: openedWoodenDoor } = await useItem({
        item: woodenDoor,
        action: woodenDoorProp.actions.open.action,
        self: playerOne as PlayerEntity,
    });

    // Test state change
    expect(openedWoodenDoor).toMatchObject({
        state: "open",
    });
    const { item: closedWoodenDoor } = await useItem({
        item: openedWoodenDoor,
        action: woodenDoorProp.actions.close.action,
        self: playerOne as PlayerEntity,
    });
    expect(closedWoodenDoor).toMatchObject({
        state: "closed",
    });

    /*
     * Test `configureItem`
     */

    const portalOneGeohash = geohash;
    const portalTwoGeohash = "gbsuv77w"; // somwhere far away
    let portalOne = (await spawnItem({
        geohash: portalOneGeohash,
        prop: compendium.portal.prop,
        variables: {
            [compendium.portal.variables!.description.variable]: "Portal One",
        },
    })) as ItemEntity;
    let portalTwo = (await spawnItem({
        geohash: portalTwoGeohash,
        prop: compendium.portal.prop,
        variables: {
            [compendium.portal.variables!.description.variable]: "Portal Two",
        },
    })) as ItemEntity;

    // Test item location (more than 1 cell)
    expect(portalTwo.location).toMatchObject([
        "gbsuv77w",
        "gbsuv77y",
        "gbsuv77t",
        "gbsuv77v",
    ]);

    // Test initial attributes
    let portalOneAttributes = itemAttibutes(portalOne);
    let portalTwoAttributes = itemAttibutes(portalTwo);
    expect(portalOneAttributes).toMatchObject({
        traversable: 1,
        destructible: false,
        description: "Portal One. It is tuned to teleport to ${target}.",
        variant: "default",
    });
    expect(portalTwoAttributes).toMatchObject({
        traversable: 1,
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
        traversable: 1,
        destructible: false,
        description: `Portal One. It is tuned to teleport to ${portalTwo.item}.`,
        variant: "default",
    });
    expect(portalTwoAttributes).toMatchObject({
        traversable: 1,
        destructible: false,
        description: `Portal Two. It is tuned to teleport to ${portalOne.item}.`,
        variant: "default",
    });

    // Test `itemVariableValue`
    const portalOneTarget = await itemVariableValue(portalOne, "target");
    expect(portalOneTarget).toMatchObject(portalTwo);

    // Test `updatedItemVariables`
    const newVariables = updatedItemVariables(portalOne, {
        description: `Portal One updated description.`,
    });
    expect(JSON.parse(newVariables)).toMatchObject({
        description: "Portal One updated description.",
        target: portalTwo.item,
    });

    /*
     * Test using item ability
     */

    const beforeCharges = portalOne.charges;
    const beforeDurability = portalOne.durability;
    expect(playerOne.location[0] === portalTwo.location[0]).toBe(false);
    let itemResult = await useItem({
        item: portalOne,
        action: compendium.portal.actions.teleport.action,
        self: playerOne as PlayerEntity,
    });
    portalOne = itemResult.item;
    playerOne = itemResult.self as PlayerEntity;

    expect(portalOne.charges).toBe(
        beforeCharges - compendium.portal.actions.teleport.cost.charges,
    );
    expect(portalOne.durability).toBe(
        beforeDurability - compendium.portal.actions.teleport.cost.durability,
    );
    expect(playerOne.location[0] === portalTwo.location[0]).toBe(true);

    /*
     * Test taking item which is untakeable
     */

    await expect(
        commandTakeItem({ item: portalTwo.item }, { Cookie: playerOneCookies }),
    ).rejects.toThrowError(`${portalTwo.item} cannot be taken`);

    /*
     * Test item permissions
     */

    // Test owner permissions
    let playerOneWoodenClub = await spawnItem({
        geohash: playerOne.location[0],
        prop: compendium.woodenClub.prop,
        owner: playerOne.player,
        configOwner: playerOne.player,
    });

    // Take item
    playerOneWoodenClub = await commandTakeItem(
        { item: playerOneWoodenClub.item },
        { Cookie: playerOneCookies },
    );

    // Test cannot use item without equipping
    var { status, message } = await useItem({
        item: playerOneWoodenClub,
        action: compendium.woodenClub.actions.swing.action,
        self: playerOne as PlayerEntity,
        target: playerTwo as PlayerEntity,
    });
    expect(status).toBe("failure");
    expect(message).toBe(
        `${playerOneWoodenClub.item} is not equipped in the required slot`,
    );

    // Equip item
    playerOneWoodenClub = await equipItem(
        {
            item: playerOneWoodenClub.item,
            slot: "rh",
        },
        { Cookie: playerOneCookies },
    );

    // Test target out of range
    var { status, message } = await useItem({
        item: playerOneWoodenClub,
        action: compendium.woodenClub.actions.swing.action,
        self: playerOne as PlayerEntity,
        target: playerTwo as PlayerEntity,
    });
    expect(status).toBe("failure");
    expect(message).toBe("Target out of range");

    // Test in range and have permissions
    playerTwo.location[0] = playerOne.location[0];
    await expect(
        useItem({
            item: playerOneWoodenClub,
            action: compendium.woodenClub.actions.swing.action,
            self: playerOne as PlayerEntity,
            target: playerTwo as PlayerEntity,
        }),
    ).resolves.toMatchObject({
        item: {
            owner: playerOne.player,
            configOwner: playerOne.player,
            durability: 99,
            charges: 0,
        },
        target: {
            player: playerTwo.player,
            hp: 9, // take one damage
        },
        self: {
            player: playerOne.player,
            ap: 10, // item uses charges instead of user's resources
            st: 10, // item uses charges instead of user's resources
        },
        status: "success",
        message: "",
    });

    // Test negative permissions
    var { status, message } = await useItem({
        item: playerOneWoodenClub,
        action: compendium.woodenClub.actions.swing.action,
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
                [compendium.woodenClub.variables.etching.variable]:
                    "An etching",
            },
        })
    ).item;
    expect(itemAttibutes(playerOneWoodenClub)).toMatchObject({
        traversable: 1,
        destructible: true,
        description: "A simple wooden club An etching.",
        variant: "default",
    });

    // Test negative config permissions
    var { status, message } = await configureItem({
        self: playerTwo as PlayerEntity,
        item: playerOneWoodenClub,
        variables: {
            [compendium.woodenClub.variables.etching.variable]:
                "playerTwo's etching",
        },
    });
    expect(status).toBe("failure");
    expect(message).toBe(
        `${playerTwo.player} does not own ${playerOneWoodenClub.item}`,
    );

    // Test config public item
    woodenDoor = (
        await configureItem({
            self: playerOne as PlayerEntity,
            item: woodenDoor,
            variables: {
                [compendium.woodenDoor.variables!.doorSign.variable]:
                    "A public door sign",
            },
        })
    ).item;
    expect(woodenDoor).toMatchObject({
        variables: '{"doorSign":"A public door sign"}',
    });
});
