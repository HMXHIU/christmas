import { compendium, itemAttibutes } from "$lib/crossover/world/compendium";
import { configureItem, spawnItem, useItem } from "$lib/server/crossover";
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
    const woodenDoor = (await spawnItem({
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
        geohash: geohash,
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
        desctructible: false,
        description: "A custom door sign. The door is closed.",
        variant: "closed",
    });

    /*
     * Test `useItem`
     */
    const woodenDoorProp = compendium[woodenDoor.prop];
    const { item: openedWoodenDoor } = await useItem({
        item: woodenDoor,
        action: woodenDoorProp.actions!.open.action,
        self: playerOne as PlayerEntity,
    });

    // Test state change
    expect(openedWoodenDoor).toMatchObject({
        state: "open",
    });
    const { item: closedWoodenDoor } = await useItem({
        item: openedWoodenDoor,
        action: woodenDoorProp.actions!.close.action,
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

    // Test initial attributes
    let portalOneAttributes = itemAttibutes(portalOne);
    let portalTwoAttributes = itemAttibutes(portalTwo);
    expect(portalOneAttributes).toMatchObject({
        traversable: 1,
        desctructible: false,
        description: "Portal One. It is tuned to teleport to ${target}.",
        variant: "default",
    });
    expect(portalTwoAttributes).toMatchObject({
        traversable: 1,
        desctructible: false,
        description: "Portal Two. It is tuned to teleport to ${target}.",
        variant: "default",
    });

    // Test changing variables
    portalOne = await configureItem({
        self: playerOne as PlayerEntity,
        item: portalOne,
        variables: {
            [compendium.portal.variables!.target.variable]: portalTwo.item,
        },
    });
    portalTwo = await configureItem({
        self: playerTwo as PlayerEntity,
        item: portalTwo,
        variables: {
            [compendium.portal.variables!.target.variable]: portalOne.item,
        },
    });
    portalOneAttributes = itemAttibutes(portalOne);
    portalTwoAttributes = itemAttibutes(portalTwo);
    expect(portalOneAttributes).toMatchObject({
        traversable: 1,
        desctructible: false,
        description: `Portal One. It is tuned to teleport to ${portalTwo.item}.`,
        variant: "default",
    });
    expect(portalTwoAttributes).toMatchObject({
        traversable: 1,
        desctructible: false,
        description: `Portal Two. It is tuned to teleport to ${portalOne.item}.`,
        variant: "default",
    });

    // Test using item ability
    const beforeCharges = portalOne.charges;
    const beforeDurability = portalOne.durability;
    expect(playerOne.geohash === portalTwo.geohash).toBe(false);
    portalOne = (
        await useItem({
            item: portalOne,
            action: compendium.portal.actions!.teleport.action,
            self: playerOne as PlayerEntity,
        })
    ).item;
    expect(portalOne.charges).toBe(
        beforeCharges - compendium.portal.actions!.teleport.cost.charges,
    );
    expect(portalOne.durability).toBe(
        beforeDurability - compendium.portal.actions!.teleport.cost.durability,
    );
    expect(playerOne.geohash === portalTwo.geohash).toBe(true);
});
