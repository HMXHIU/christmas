import {
    commandTakeItem,
    equipItem,
    playerInventory,
    unequipItem,
} from "$lib/crossover";
import { compendium } from "$lib/crossover/world/compendium";
import { spawnItem } from "$lib/server/crossover";
import { expect, test } from "vitest";
import { getRandomRegion } from "../utils";
import { createRandomPlayer } from "./utils";

test("Test Inventory", async () => {
    const geohash = "w21z3we7";
    const region = String.fromCharCode(...getRandomRegion());

    // Spawn player
    const playerOneName = "Gandalf";
    const playerOneGeohash = geohash;
    let [playerOneWallet, playerOneCookies, playerOne] =
        await createRandomPlayer({
            region,
            geohash: playerOneGeohash,
            name: playerOneName,
        });

    // Spawn item at player one
    let playerOneWoodenClub = await spawnItem({
        geohash: playerOne.location[0],
        prop: compendium.woodenClub.prop,
        owner: playerOne.player,
        configOwner: playerOne.player,
    });
    expect(playerOneWoodenClub).toMatchObject({
        location: playerOne.location,
        locationType: "geohash",
        owner: playerOne.player,
        configOwner: playerOne.player,
    });

    // Check empty inventory
    let inventory = await playerInventory({ Cookie: playerOneCookies });
    expect(inventory).deep.equal([]);

    // Take item
    playerOneWoodenClub = await commandTakeItem(
        { item: playerOneWoodenClub.item },
        { Cookie: playerOneCookies },
    );
    expect(playerOneWoodenClub).toMatchObject({
        location: [playerOne.player],
        locationType: "inv",
    });

    // Check inventory
    inventory = await playerInventory({ Cookie: playerOneCookies });
    expect(inventory).toMatchObject([
        {
            item: playerOneWoodenClub.item,
            location: [playerOne.player],
            locationType: "inv",
        },
    ]);

    // Equip item - rh
    playerOneWoodenClub = await equipItem(
        { item: playerOneWoodenClub.item, slot: "rh" },
        { Cookie: playerOneCookies },
    );
    expect(playerOneWoodenClub).toMatchObject({
        location: [playerOne.player],
        locationType: "rh",
    });

    // Check inventory
    inventory = await playerInventory({ Cookie: playerOneCookies });
    expect(inventory).toMatchObject([
        {
            item: playerOneWoodenClub.item,
            location: [playerOne.player],
            locationType: "rh",
        },
    ]);

    // Equip item - lh
    playerOneWoodenClub = await equipItem(
        { item: playerOneWoodenClub.item, slot: "lh" },
        { Cookie: playerOneCookies },
    );
    expect(playerOneWoodenClub).toMatchObject({
        location: [playerOne.player],
        locationType: "lh",
    });

    // Check inventory
    inventory = await playerInventory({ Cookie: playerOneCookies });
    expect(inventory).toMatchObject([
        {
            item: playerOneWoodenClub.item,
            location: [playerOne.player],
            locationType: "lh",
        },
    ]);

    // Unequip item
    playerOneWoodenClub = await unequipItem(
        { item: playerOneWoodenClub.item },
        { Cookie: playerOneCookies },
    );
    expect(playerOneWoodenClub).toMatchObject({
        location: [playerOne.player],
        locationType: "inv",
    });

    // Check inventory
    inventory = await playerInventory({ Cookie: playerOneCookies });
    expect(inventory).toMatchObject([
        {
            item: playerOneWoodenClub.item,
            location: [playerOne.player],
            locationType: "inv",
        },
    ]);
});
