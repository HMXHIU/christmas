import {
    crossoverCmdDrop,
    crossoverCmdEquip,
    crossoverCmdMove,
    crossoverCmdTake,
    crossoverCmdUnequip,
    crossoverPlayerInventory,
} from "$lib/crossover/client";
import { LOCATION_INSTANCE, MS_PER_TICK } from "$lib/crossover/world/settings";
import { actions } from "$lib/crossover/world/settings/actions";
import { compendium } from "$lib/crossover/world/settings/compendium";
import { spawnItemAtGeohash } from "$lib/server/crossover/dm";
import { fetchEntity } from "$lib/server/crossover/redis/utils";
import type { ItemEntity, PlayerEntity } from "$lib/server/crossover/types";
import { sleep } from "$lib/utils";
import { describe, expect, test } from "vitest";
import { createGandalfSarumanSauron, waitForEventData } from "../utils";

describe("Inventory & Equipment Tests", async () => {
    let { geohash, playerOne, playerOneCookies, playerOneStream } =
        await createGandalfSarumanSauron();

    let woodenClub: ItemEntity = await spawnItemAtGeohash({
        geohash,
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        prop: compendium.woodenclub.prop,
        owner: playerOne.player,
        configOwner: playerOne.player,
    });

    test("Unable to equip item if not in inventory", async () => {
        crossoverCmdEquip(
            { item: woodenClub.item, slot: "rh" },
            { Cookie: playerOneCookies },
        );
        await expect(
            waitForEventData(playerOneStream, "feed"),
        ).resolves.toMatchObject({
            message: `${woodenClub.item} is not in inventory`,
            type: "error",
        });
        await sleep(MS_PER_TICK * actions.equip.ticks);
    });

    test("Take item and check inventory", async () => {
        // Check empty inventory
        crossoverPlayerInventory({ Cookie: playerOneCookies });
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
        crossoverCmdTake(
            { item: woodenClub.item },
            { Cookie: playerOneCookies },
        );
        await waitForEventData(playerOneStream, "entities");
        await sleep(MS_PER_TICK * 2);

        woodenClub = (await fetchEntity(woodenClub.item)) as ItemEntity;
        expect(woodenClub).toMatchObject({
            loc: [playerOne.player],
            locT: "inv",
        });

        // Check inventory
        crossoverPlayerInventory({ Cookie: playerOneCookies });
        await expect(
            waitForEventData(playerOneStream, "entities"),
        ).resolves.toMatchObject({
            event: "entities",
            players: [],
            monsters: [],
            items: [{ item: woodenClub.item }],
            op: "upsert",
        });
    });

    test("Drop item", async () => {
        crossoverCmdDrop(
            { item: woodenClub.item },
            { Cookie: playerOneCookies },
        );
        await waitForEventData(playerOneStream, "entities");
        await sleep(MS_PER_TICK * 2);

        woodenClub = (await fetchEntity(woodenClub.item)) as ItemEntity;
        expect(woodenClub).toMatchObject({
            loc: playerOne.loc,
            locT: "geohash",
            own: playerOne.player,
            cfg: playerOne.player,
        });
    });

    test("Cannot take item if not in geohash", async () => {
        // Move player to a different geohash
        crossoverCmdMove({ path: ["s", "s"] }, { Cookie: playerOneCookies });
        await waitForEventData(playerOneStream, "entities");
        await sleep(MS_PER_TICK * 4);

        playerOne = (await fetchEntity(playerOne.player)) as PlayerEntity;
        expect(playerOne.loc[0]).not.equal(woodenClub.loc[0]);

        // Try take item
        var error = `${woodenClub.item} is not in range`;
        crossoverCmdTake(
            { item: woodenClub.item },
            { Cookie: playerOneCookies },
        ),
            await expect(
                waitForEventData(playerOneStream, "feed"),
            ).resolves.toMatchObject({
                type: "error",
                message: error,
            });
        await sleep(MS_PER_TICK * 2);

        // Move back to item
        crossoverCmdMove({ path: ["n", "n"] }, { Cookie: playerOneCookies });
        await sleep(MS_PER_TICK * 4);

        playerOne = (await fetchEntity(playerOne.player)) as PlayerEntity;
        expect(playerOne.loc[0]).equal(woodenClub.loc[0]);

        // Take item
        crossoverCmdTake(
            { item: woodenClub.item },
            { Cookie: playerOneCookies },
        );
        await waitForEventData(playerOneStream, "entities");
        await sleep(MS_PER_TICK * 2);

        woodenClub = (await fetchEntity(woodenClub.item)) as ItemEntity;
        expect(woodenClub).toMatchObject({
            loc: [playerOne.player],
            locT: "inv",
        });
    });

    test("Equip and unequip item", async () => {
        // Try to equip item in the wrong slot
        var error = `${woodenClub.item} cannot be equipped in hd`;
        crossoverCmdEquip(
            { item: woodenClub.item, slot: "hd" },
            { Cookie: playerOneCookies },
        );
        await expect(
            waitForEventData(playerOneStream, "feed"),
        ).resolves.toMatchObject({
            type: "error",
            message: error,
        });
        await sleep(MS_PER_TICK * 2);

        // Equip item - rh
        crossoverCmdEquip(
            { item: woodenClub.item, slot: "rh" },
            { Cookie: playerOneCookies },
        );
        await waitForEventData(playerOneStream, "entities");
        await sleep(MS_PER_TICK * 2);

        woodenClub = (await fetchEntity(woodenClub.item)) as ItemEntity;
        expect(woodenClub).toMatchObject({
            loc: [playerOne.player],
            locT: "rh",
        });

        // Check inventory
        crossoverPlayerInventory({ Cookie: playerOneCookies });
        await expect(
            waitForEventData(playerOneStream, "entities"),
        ).resolves.toMatchObject({
            items: [
                {
                    item: woodenClub.item,
                    loc: [playerOne.player],
                    locT: "rh",
                },
            ],
            op: "upsert",
        });
        await sleep(MS_PER_TICK * 2);

        // Unequip item
        crossoverCmdUnequip(
            { item: woodenClub.item },
            { Cookie: playerOneCookies },
        );
        await waitForEventData(playerOneStream, "entities");
        await sleep(MS_PER_TICK * 2);
        woodenClub = (await fetchEntity(woodenClub.item)) as ItemEntity;
        expect(woodenClub).toMatchObject({
            item: woodenClub.item,
            loc: [playerOne.player],
            locT: "inv",
        });

        // Check inventory
        crossoverPlayerInventory({ Cookie: playerOneCookies });
        await expect(
            waitForEventData(playerOneStream, "entities"),
        ).resolves.toMatchObject({
            items: [
                {
                    item: woodenClub.item,
                    loc: [playerOne.player],
                    locT: "inv",
                },
            ],
            op: "upsert",
        });
        await sleep(MS_PER_TICK * 2);
    });

    test("Unable to equip unequippable item", async () => {
        let potionofhealth = await spawnItemAtGeohash({
            geohash: playerOne.loc[0],
            locationType: "geohash",
            locationInstance: LOCATION_INSTANCE,
            prop: compendium.potionofhealth.prop,
        });
        await sleep(MS_PER_TICK * 2);

        // Take item
        crossoverCmdTake(
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
        crossoverCmdEquip(
            { item: potionofhealth.item, slot: "lh" },
            { Cookie: playerOneCookies },
        ),
            await expect(
                waitForEventData(playerOneStream, "feed"),
            ).resolves.toMatchObject({
                type: "error",
                message: `${potionofhealth.item} is not equippable`,
            });
        await sleep(MS_PER_TICK * 2);
    });

    test("Unable to take item belonging to another player", async () => {
        let unpickablePotion = await spawnItemAtGeohash({
            geohash: playerOne.loc[0],
            locationType: "geohash",
            locationInstance: LOCATION_INSTANCE,
            prop: compendium.potionofhealth.prop,
            owner: "anotherPlayer",
        });
        await sleep(MS_PER_TICK * 2);

        // Try take item
        crossoverCmdTake(
            { item: unpickablePotion.item },
            { Cookie: playerOneCookies },
        );
        await expect(
            waitForEventData(playerOneStream, "feed"),
        ).resolves.toMatchObject({
            type: "error",
            message: `${unpickablePotion.item} is owned by someone else`,
        });
    });
});
