import {
    crossoverCmdDrop,
    crossoverCmdEquip,
    crossoverCmdMove,
    crossoverCmdTake,
    crossoverCmdUnequip,
    crossoverPlayerInventory,
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

    // Spawn woodenclub
    let playerOneWoodenClub = await spawnItem({
        geohash: playerOne.location[0],
        prop: compendium.woodenclub.prop,
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
        crossoverCmdEquip(
            { item: playerOneWoodenClub.item, slot: "rh" },
            { Cookie: playerOneCookies },
        ),
    ).resolves.toMatchObject({
        message: `${playerOneWoodenClub.item} is not in inventory`,
        status: "failure",
    });

    /*
     * Test `crossoverCmdTake` and `crossoverPlayerInventory`
     */

    // Check empty inventory
    let inventory = await crossoverPlayerInventory({
        Cookie: playerOneCookies,
    });
    expect(inventory).deep.equal({
        items: [],
        status: "success",
        op: "upsert",
    });

    // Take item
    playerOneWoodenClub = (
        await crossoverCmdTake(
            { item: playerOneWoodenClub.item },
            { Cookie: playerOneCookies },
        )
    ).items?.[0]!;
    expect(playerOneWoodenClub).toMatchObject({
        location: [playerOne.player],
        locationType: "inv",
    });

    // Check inventory
    inventory = await crossoverPlayerInventory({ Cookie: playerOneCookies });
    expect(inventory).toMatchObject({
        items: [
            {
                item: playerOneWoodenClub.item,
            },
        ],
        status: "success",
        op: "upsert",
    });

    /*
     * Test `crossoverCmdDrop`
     */

    // Drop item
    playerOneWoodenClub = (
        await crossoverCmdDrop(
            { item: playerOneWoodenClub.item },
            { Cookie: playerOneCookies },
        )
    ).items?.[0]!;
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
    playerOne.location = (
        await crossoverCmdMove({ direction: "s" }, { Cookie: playerOneCookies })
    ).players?.[0].location!;
    expect(playerOne.location[0]).not.equal(playerOneWoodenClub.location[0]);

    // Try take item
    await expect(
        crossoverCmdTake(
            { item: playerOneWoodenClub.item },
            { Cookie: playerOneCookies },
        ),
    ).resolves.toMatchObject({
        status: "failure",
        message: `${playerOneWoodenClub.item} is not in range`,
    });

    // Move to item
    playerOne.location = (
        await crossoverCmdMove({ direction: "n" }, { Cookie: playerOneCookies })
    ).players?.[0].location!;
    expect(playerOne.location[0]).equal(playerOneWoodenClub.location[0]);

    // Take item
    playerOneWoodenClub = (
        await crossoverCmdTake(
            { item: playerOneWoodenClub.item },
            { Cookie: playerOneCookies },
        )
    ).items?.[0]!;
    expect(playerOneWoodenClub).toMatchObject({
        location: [playerOne.player],
        locationType: "inv",
    });

    /*
     * Test `crossoverCmdEquip`
     */

    // Try to equip item in the wrong slot
    await expect(
        crossoverCmdEquip(
            { item: playerOneWoodenClub.item, slot: "hd" },
            { Cookie: playerOneCookies },
        ),
    ).resolves.toMatchObject({
        status: "failure",
        message: `${playerOneWoodenClub.item} cannot be equipped in hd`,
    });

    // Equip item - rh
    playerOneWoodenClub = (
        await crossoverCmdEquip(
            { item: playerOneWoodenClub.item, slot: "rh" },
            { Cookie: playerOneCookies },
        )
    ).items?.[0]!;
    expect(playerOneWoodenClub).toMatchObject({
        location: [playerOne.player],
        locationType: "rh",
    });

    // Check inventory
    inventory = await crossoverPlayerInventory({ Cookie: playerOneCookies });
    expect(inventory).toMatchObject({
        items: [
            {
                item: playerOneWoodenClub.item,
                location: [playerOne.player],
                locationType: "rh",
            },
        ],
        status: "success",
        op: "upsert",
    });

    // Equip item - lh
    playerOneWoodenClub = (
        await crossoverCmdEquip(
            { item: playerOneWoodenClub.item, slot: "lh" },
            { Cookie: playerOneCookies },
        )
    ).items?.[0]!;
    expect(playerOneWoodenClub).toMatchObject({
        location: [playerOne.player],
        locationType: "lh",
    });

    // Check inventory
    inventory = await crossoverPlayerInventory({ Cookie: playerOneCookies });
    expect(inventory).toMatchObject({
        items: [
            {
                item: playerOneWoodenClub.item,
                location: [playerOne.player],
                locationType: "lh",
            },
        ],
        status: "success",
        op: "upsert",
    });

    /*
     * Test `crossoverCmdUnequip`
     */

    // Unequip item
    playerOneWoodenClub = (
        await crossoverCmdUnequip(
            { item: playerOneWoodenClub.item },
            { Cookie: playerOneCookies },
        )
    ).items?.[0]!;
    expect(playerOneWoodenClub).toMatchObject({
        item: playerOneWoodenClub.item,
        location: [playerOne.player],
        locationType: "inv",
    });

    // Check inventory
    inventory = await crossoverPlayerInventory({ Cookie: playerOneCookies });
    expect(inventory).toMatchObject({
        items: [
            {
                item: playerOneWoodenClub.item,
                location: [playerOne.player],
                locationType: "inv",
            },
        ],
        status: "success",
        op: "upsert",
    });

    /*
     * Test unable to equip unequipable item
     */

    // Spawn potion of health
    let potionofhealth = await spawnItem({
        geohash: playerOne.location[0],
        prop: compendium.potionofhealth.prop,
    });

    // Take item
    potionofhealth = (
        await crossoverCmdTake(
            { item: potionofhealth.item },
            { Cookie: playerOneCookies },
        )
    ).items?.[0]!;
    expect(potionofhealth).toMatchObject({
        location: [playerOne.player],
        locationType: "inv",
    });

    // Equip potion of health
    await expect(
        crossoverCmdEquip(
            { item: potionofhealth.item, slot: "lh" },
            { Cookie: playerOneCookies },
        ),
    ).resolves.toMatchObject({
        status: "failure",
        message: `${potionofhealth.item} is not equippable`,
    });

    /*
     * Test unable to take item belonging to another player
     */

    let unpickablePotion = await spawnItem({
        geohash: playerOne.location[0],
        prop: compendium.potionofhealth.prop,
        owner: "anotherPlayer",
    });

    // Try take item
    await expect(
        crossoverCmdTake(
            { item: unpickablePotion.item },
            { Cookie: playerOneCookies },
        ),
    ).resolves.toMatchObject({
        status: "failure",
        message: `${unpickablePotion.item} is owned by someone else`,
    });
});
