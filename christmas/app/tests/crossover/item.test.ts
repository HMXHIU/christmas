import { compendium, itemAttibutes } from "$lib/crossover/world/compendium";
import { spawnItem, useItem } from "$lib/server/crossover";
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

    // Test spawn item
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

    // Test item configuration (via variables)
    const attributes = itemAttibutes(woodenDoor);
    expect(attributes).toMatchObject({
        traversable: 0,
        desctructible: false,
        description: "A custom door sign. The door is closed.",
        variant: "closed",
    });

    // Test `useItem`
    const woodenDoorProp = compendium[woodenDoor.prop];
    const openedWoodenDoor = await useItem({
        item: woodenDoor,
        action: woodenDoorProp.actions!.open.action,
        self: playerOne as PlayerEntity,
    });
    expect(openedWoodenDoor).toMatchObject({
        state: "open",
    });
    const closedWoodenDoor = await useItem({
        item: openedWoodenDoor,
        action: woodenDoorProp.actions!.close.action,
        self: playerOne as PlayerEntity,
    });
    expect(closedWoodenDoor).toMatchObject({
        state: "closed",
    });
});
