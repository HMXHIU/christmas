import {
    commandDropItem,
    commandMove,
    commandTakeItem,
    equipItem,
    playerInventory,
    unequipItem,
} from "$lib/crossover";
import { compendium } from "$lib/crossover/world/settings";
import { spawnItem } from "$lib/server/crossover";
import { expect, test } from "vitest";
import { getRandomRegion } from "../utils";
import { createRandomPlayer } from "./utils";

test("Test Inventory", async () => {
    const geohash = "w21zfkem";
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

    // Spawn woodenClub
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

    /*
     * Test unable to equip item if not on player
     */

    // Equip item
    await expect(
        equipItem(
            { item: playerOneWoodenClub.item, slot: "rh" },
            { Cookie: playerOneCookies },
        ),
    ).rejects.toThrow(`${playerOneWoodenClub.item} is not in inventory`);

    /*
     * Test `commandTakeItem` and `playerInventory`
     */

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

    /*
     * Test `commandDropItem`
     */

    // Drop item
    playerOneWoodenClub = await commandDropItem(
        { item: playerOneWoodenClub.item },
        { Cookie: playerOneCookies },
    );
    expect(playerOneWoodenClub).toMatchObject({
        location: playerOne.location,
        locationType: "geohash",
        owner: playerOne.player,
        configOwner: playerOne.player,
    });

    /*
     * Test cannot take item if not in geohash
     */

    // Move player to a different geohash
    playerOne.location = await commandMove(
        { direction: "s" },
        { Cookie: playerOneCookies },
    );
    expect(playerOne.location[0]).not.equal(playerOneWoodenClub.location[0]);

    // Try take item
    await expect(
        commandTakeItem(
            { item: playerOneWoodenClub.item },
            { Cookie: playerOneCookies },
        ),
    ).rejects.toThrow(`${playerOneWoodenClub.item} is not in range`);

    // Move to item
    playerOne.location = await commandMove(
        { direction: "n" },
        { Cookie: playerOneCookies },
    );
    expect(playerOne.location[0]).equal(playerOneWoodenClub.location[0]);

    // Take item
    playerOneWoodenClub = await commandTakeItem(
        { item: playerOneWoodenClub.item },
        { Cookie: playerOneCookies },
    );
    expect(playerOneWoodenClub).toMatchObject({
        location: [playerOne.player],
        locationType: "inv",
    });

    /*
     * Test `equipItem`
     */

    // Try to equip item in the wrong slot
    await expect(
        equipItem(
            { item: playerOneWoodenClub.item, slot: "hd" },
            { Cookie: playerOneCookies },
        ),
    ).rejects.toThrow(`${playerOneWoodenClub.item} cannot be equipped in hd`);

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

    /*
     * Test `unequipItem`
     */

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

    /*
     * Test unable to equip unequipable item
     */

    // Spawn potion of health
    let potionOfHealth = await spawnItem({
        geohash: playerOne.location[0],
        prop: compendium.potionOfHealth.prop,
    });

    // Take item
    potionOfHealth = await commandTakeItem(
        { item: potionOfHealth.item },
        { Cookie: playerOneCookies },
    );
    expect(potionOfHealth).toMatchObject({
        location: [playerOne.player],
        locationType: "inv",
    });

    // Equip potion of health
    await expect(
        equipItem(
            { item: potionOfHealth.item, slot: "lh" },
            { Cookie: playerOneCookies },
        ),
    ).rejects.toThrow(`${potionOfHealth.item} is not equippable`);

    /*
     * Test unable to take item belonging to another player
     */

    let unpickablePotion = await spawnItem({
        geohash: playerOne.location[0],
        prop: compendium.potionOfHealth.prop,
        owner: "anotherPlayer",
    });

    // Try take item
    await expect(
        commandTakeItem(
            { item: unpickablePotion.item },
            { Cookie: playerOneCookies },
        ),
    ).rejects.toThrow(`${unpickablePotion.item} is owned by someone else`);
});
