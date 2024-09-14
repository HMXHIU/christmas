import {
    crossoverCmdDrop,
    crossoverCmdEquip,
    crossoverCmdMove,
    crossoverCmdTake,
    crossoverCmdUnequip,
    crossoverPlayerInventory,
    stream,
} from "$lib/crossover/client";
import { LOCATION_INSTANCE, MS_PER_TICK } from "$lib/crossover/world/settings";
import { compendium } from "$lib/crossover/world/settings/compendium";
import { spawnItem } from "$lib/server/crossover/dungeonMaster";
import { fetchEntity, initializeClients } from "$lib/server/crossover/redis";
import type {
    ItemEntity,
    Player,
    PlayerEntity,
} from "$lib/server/crossover/redis/entities";
import { sleep } from "$lib/utils";
import { beforeAll, describe, expect, test } from "vitest";
import { getRandomRegion } from "../utils";
import {
    createRandomPlayer,
    generateRandomGeohash,
    waitForEventData,
} from "./utils";

const geohash = generateRandomGeohash(8, "h9");
const region = String.fromCharCode(...getRandomRegion());
let playerOne: Player;
let playerOneCookies: string;
let playerOneStream: EventTarget;
let playerOneWoodenClub: ItemEntity;

beforeAll(async () => {
    await initializeClients(); // create redis repositories

    // Spawn player
    [, playerOneCookies, playerOne] = await createRandomPlayer({
        region,
        geohash,
        name: "Gandalf",
    });
    [playerOneStream] = await stream({ Cookie: playerOneCookies });
    await expect(
        waitForEventData(playerOneStream, "feed"),
    ).resolves.toMatchObject({
        type: "system",
        message: "started",
    });

    // Spawn woodenclub
    playerOneWoodenClub = await spawnItem({
        geohash: playerOne.loc[0],
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        prop: compendium.woodenclub.prop,
        owner: playerOne.player,
        configOwner: playerOne.player,
    });
});

describe("Inventory Tests", () => {
    test("Unable to equip item if not in inventory", async () => {
        const error = `${playerOneWoodenClub.item} is not in inventory`;
        await expect(
            crossoverCmdEquip(
                { item: playerOneWoodenClub.item, slot: "rh" },
                { Cookie: playerOneCookies },
            ),
        ).rejects.toThrow(error);
        await expect(
            waitForEventData(playerOneStream, "feed"),
        ).resolves.toMatchObject({
            message: error,
            type: "error",
        });
        await sleep(MS_PER_TICK * 2);
    });

    test("Take item and check inventory", async () => {
        // Check empty inventory
        await crossoverPlayerInventory({ Cookie: playerOneCookies });
        await expect(
            waitForEventData(playerOneStream, "entities"),
        ).resolves.toMatchObject({
            event: "entities",
            players: [],
            monsters: [],
            items: [],
            op: "upsert",
        });
        await sleep(MS_PER_TICK * 2);

        // Take item
        await crossoverCmdTake(
            { item: playerOneWoodenClub.item },
            { Cookie: playerOneCookies },
        );
        await waitForEventData(playerOneStream, "entities");
        await sleep(MS_PER_TICK * 2);

        playerOneWoodenClub = (await fetchEntity(
            playerOneWoodenClub.item,
        )) as ItemEntity;
        expect(playerOneWoodenClub).toMatchObject({
            loc: [playerOne.player],
            locT: "inv",
        });

        // Check inventory
        await crossoverPlayerInventory({ Cookie: playerOneCookies });
        await expect(
            waitForEventData(playerOneStream, "entities"),
        ).resolves.toMatchObject({
            event: "entities",
            players: [],
            monsters: [],
            items: [{ item: playerOneWoodenClub.item }],
            op: "upsert",
        });
    });

    test("Drop item", async () => {
        await crossoverCmdDrop(
            { item: playerOneWoodenClub.item },
            { Cookie: playerOneCookies },
        );
        await waitForEventData(playerOneStream, "entities");
        await sleep(MS_PER_TICK * 2);

        playerOneWoodenClub = (await fetchEntity(
            playerOneWoodenClub.item,
        )) as ItemEntity;
        expect(playerOneWoodenClub).toMatchObject({
            loc: playerOne.loc,
            locT: "geohash",
            own: playerOne.player,
            cfg: playerOne.player,
        });
    });

    test("Cannot take item if not in geohash", async () => {
        // Move player to a different geohash
        await crossoverCmdMove(
            { path: ["s", "s"] },
            { Cookie: playerOneCookies },
        );
        await waitForEventData(playerOneStream, "entities");
        await sleep(MS_PER_TICK * 4);

        playerOne = (await fetchEntity(playerOne.player)) as PlayerEntity;
        expect(playerOne.loc[0]).not.equal(playerOneWoodenClub.loc[0]);

        // Try take item
        var error = `${playerOneWoodenClub.item} is not in range`;
        await expect(
            crossoverCmdTake(
                { item: playerOneWoodenClub.item },
                { Cookie: playerOneCookies },
            ),
        ).rejects.toThrow(error);
        await expect(
            waitForEventData(playerOneStream, "feed"),
        ).resolves.toMatchObject({
            type: "error",
            message: error,
        });
        await sleep(MS_PER_TICK * 2);

        // Move back to item
        await crossoverCmdMove(
            { path: ["n", "n"] },
            { Cookie: playerOneCookies },
        );
        await sleep(MS_PER_TICK * 4);

        playerOne = (await fetchEntity(playerOne.player)) as PlayerEntity;
        expect(playerOne.loc[0]).equal(playerOneWoodenClub.loc[0]);

        // Take item
        await crossoverCmdTake(
            { item: playerOneWoodenClub.item },
            { Cookie: playerOneCookies },
        );
        await waitForEventData(playerOneStream, "entities");
        await sleep(MS_PER_TICK * 2);

        playerOneWoodenClub = (await fetchEntity(
            playerOneWoodenClub.item,
        )) as ItemEntity;
        expect(playerOneWoodenClub).toMatchObject({
            loc: [playerOne.player],
            locT: "inv",
        });
    });

    test("Equip and unequip item", async () => {
        // Try to equip item in the wrong slot
        var error = `${playerOneWoodenClub.item} cannot be equipped in hd`;
        await expect(
            crossoverCmdEquip(
                { item: playerOneWoodenClub.item, slot: "hd" },
                { Cookie: playerOneCookies },
            ),
        ).rejects.toThrow(error);
        await expect(
            waitForEventData(playerOneStream, "feed"),
        ).resolves.toMatchObject({
            type: "error",
            message: error,
        });
        await sleep(MS_PER_TICK * 2);

        // Equip item - rh
        await crossoverCmdEquip(
            { item: playerOneWoodenClub.item, slot: "rh" },
            { Cookie: playerOneCookies },
        );
        await waitForEventData(playerOneStream, "entities");
        await sleep(MS_PER_TICK * 2);

        playerOneWoodenClub = (await fetchEntity(
            playerOneWoodenClub.item,
        )) as ItemEntity;
        expect(playerOneWoodenClub).toMatchObject({
            loc: [playerOne.player],
            locT: "rh",
        });

        // Check inventory
        await crossoverPlayerInventory({ Cookie: playerOneCookies });
        await expect(
            waitForEventData(playerOneStream, "entities"),
        ).resolves.toMatchObject({
            items: [
                {
                    item: playerOneWoodenClub.item,
                    loc: [playerOne.player],
                    locT: "rh",
                },
            ],
            op: "upsert",
        });
        await sleep(MS_PER_TICK * 2);

        // Unequip item
        await crossoverCmdUnequip(
            { item: playerOneWoodenClub.item },
            { Cookie: playerOneCookies },
        );
        await waitForEventData(playerOneStream, "entities");
        await sleep(MS_PER_TICK * 2);
        playerOneWoodenClub = (await fetchEntity(
            playerOneWoodenClub.item,
        )) as ItemEntity;
        expect(playerOneWoodenClub).toMatchObject({
            item: playerOneWoodenClub.item,
            loc: [playerOne.player],
            locT: "inv",
        });

        // Check inventory
        await crossoverPlayerInventory({ Cookie: playerOneCookies });
        await expect(
            waitForEventData(playerOneStream, "entities"),
        ).resolves.toMatchObject({
            items: [
                {
                    item: playerOneWoodenClub.item,
                    loc: [playerOne.player],
                    locT: "inv",
                },
            ],
            op: "upsert",
        });
        await sleep(MS_PER_TICK * 2);
    });

    test("Unable to equip unequippable item", async () => {
        let potionofhealth = await spawnItem({
            geohash: playerOne.loc[0],
            locationType: "geohash",
            locationInstance: LOCATION_INSTANCE,
            prop: compendium.potionofhealth.prop,
        });
        await sleep(MS_PER_TICK * 2);

        // Take item
        await crossoverCmdTake(
            { item: potionofhealth.item },
            { Cookie: playerOneCookies },
        );
        await waitForEventData(playerOneStream, "entities");
        await sleep(MS_PER_TICK * 2);

        potionofhealth = (await fetchEntity(potionofhealth.item)) as ItemEntity;
        expect(potionofhealth).toMatchObject({
            loc: [playerOne.player],
            locT: "inv",
        });

        // Try to equip potion of health
        var error = `${potionofhealth.item} is not equippable`;
        await expect(
            crossoverCmdEquip(
                { item: potionofhealth.item, slot: "lh" },
                { Cookie: playerOneCookies },
            ),
        ).rejects.toThrow(error);
        await expect(
            waitForEventData(playerOneStream, "feed"),
        ).resolves.toMatchObject({
            type: "error",
            message: error,
        });
        await sleep(MS_PER_TICK * 2);
    });

    test("Unable to take item belonging to another player", async () => {
        let unpickablePotion = await spawnItem({
            geohash: playerOne.loc[0],
            locationType: "geohash",
            locationInstance: LOCATION_INSTANCE,
            prop: compendium.potionofhealth.prop,
            owner: "anotherPlayer",
        });
        await sleep(MS_PER_TICK * 2);

        // Try take item
        var error = `${unpickablePotion.item} is owned by someone else`;
        await expect(
            crossoverCmdTake(
                { item: unpickablePotion.item },
                { Cookie: playerOneCookies },
            ),
        ).rejects.toThrow(error);
        await expect(
            waitForEventData(playerOneStream, "feed"),
        ).resolves.toMatchObject({
            type: "error",
            message: error,
        });
    });
});
