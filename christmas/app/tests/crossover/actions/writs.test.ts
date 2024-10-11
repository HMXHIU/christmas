import {
    crossoverCmdBrowse,
    crossoverCmdFulfill,
    crossoverCmdWrit,
} from "$lib/crossover/client";
import { MS_PER_TICK } from "$lib/crossover/world/settings";
import { actions } from "$lib/crossover/world/settings/actions";
import { compendium } from "$lib/crossover/world/settings/compendium";
import { spawnItemInInventory } from "$lib/server/crossover/dm";
import { fetchEntity, saveEntity } from "$lib/server/crossover/redis/utils";
import { sleep } from "$lib/utils";
import { beforeEach, describe, expect, test } from "vitest";
import {
    createGandalfSarumanSauron,
    resetEntityResources,
    waitForAnyEventData,
    waitForEventData,
} from "../utils";

describe("Writ Tests", async () => {
    let {
        geohash,
        playerOne,
        playerOneCookies,
        playerOneStream,
        playerTwo,
        playerTwoCookies,
        playerTwoStream,
    } = await createGandalfSarumanSauron();

    let woodenclub = await spawnItemInInventory({
        entity: playerTwo,
        prop: compendium.woodenclub.prop,
    });

    beforeEach(async () => {
        await resetEntityResources(playerOne, playerTwo);

        // Put woodenclub in `playerTwo` inventory
        woodenclub.loc[0] = playerTwo.player;
        woodenclub.locI = playerTwo.locI;
        woodenclub.locT = "inv";
        woodenclub = await saveEntity(woodenclub);
    });

    test("Create, Browse, Fulfill trade writs", async () => {
        /**
         * Create
         */

        // `playerTwo` create writ to sell `woodenclub` for 100 lum
        crossoverCmdWrit(
            {
                buyer: playerTwo.player,
                seller: "",
                offer: {
                    items: [woodenclub.item],
                },
                receive: {
                    currency: {
                        lum: 100,
                    },
                },
            },
            { Cookie: playerTwoCookies },
        );

        // Check received writ
        await expect(
            waitForEventData(playerTwoStream, "feed"),
        ).resolves.toMatchObject({
            type: "message",
            message: "You received a trade writ in your inventory.",
            event: "feed",
        });

        await sleep(MS_PER_TICK * actions.writ.ticks * 2);

        /**
         * Browse
         */

        // Browse trade writs on `playerTwo`
        crossoverCmdBrowse(
            { player: playerTwo.player },
            { Cookie: playerOneCookies },
        );
        var evs = await waitForAnyEventData(playerOneStream);

        // Check entitites
        expect(evs.entities).toMatchObject({
            event: "entities",
            players: [],
            monsters: [],
            items: [
                {
                    name: "Trade writ",
                    prop: "tradewrit",
                    state: "default",
                    vars: {
                        offer: "Wooden Club",
                        receive: "100 lum",
                    },
                },
            ],
            op: "upsert",
        });

        // Check feed
        expect(evs.feed).toMatchObject({
            type: "message",
            event: "feed",
        });
        expect(
            evs.feed?.message.startsWith(
                `${playerTwo.name} is offering:\n\nWooden Club for 100 lum [item_tradewrit`,
            ),
        ).toBeTruthy();

        /**
         * Fulfill
         */

        // `playerOne` fulfill trade writ on `playerTwo`
        const match = evs.feed?.message.match(/\[(item_tradewrit\d+)\]/); // extract the writ from the browse message
        expect(match).toBeTruthy();
        const writId = match![1];

        // Check conditions not met
        crossoverCmdFulfill({ item: writId }, { Cookie: playerOneCookies });
        await expect(
            waitForEventData(playerOneStream, "feed"),
        ).resolves.toMatchObject({
            type: "error",
            message: "Gandalf does not have 100 lum.",
            event: "feed",
        });

        await sleep(MS_PER_TICK * actions.trade.ticks * 2);

        // Give `playerOne` 100 lum
        playerOne.lum += 100;
        playerOne = await saveEntity(playerOne);

        crossoverCmdFulfill({ item: writId }, { Cookie: playerOneCookies });
        await expect(
            waitForEventData(playerOneStream, "feed"),
        ).resolves.toMatchObject({
            type: "message",
            message: "${message}",
            variables: {
                cmd: "say",
                name: "Saruman",
                message:
                    "Saruman hands you Wooden Club, 'Pleasure doing business with you, Gandalf'",
            },
            event: "feed",
        });
        await sleep(MS_PER_TICK * actions.trade.ticks * 2);

        // Check that the writ is destroyed
        await expect(fetchEntity(writId)).resolves.toBeNull();
    });
});
