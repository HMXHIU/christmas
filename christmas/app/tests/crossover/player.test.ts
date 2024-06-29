import {
    crossoverCmdConfigureItem,
    crossoverCmdCreateItem,
    crossoverCmdEquip,
    crossoverCmdLook,
    crossoverCmdMove,
    crossoverCmdPerformAbility,
    crossoverCmdSay,
    crossoverCmdTake,
    crossoverCmdUseItem,
    stream,
} from "$lib/crossover";
import { abilities } from "$lib/crossover/world/abilities";
import { compendium, itemAttibutes } from "$lib/crossover/world/compendium";
import { playerStats } from "$lib/crossover/world/player";
import { MS_PER_TICK } from "$lib/crossover/world/settings";
import { worldSeed } from "$lib/crossover/world/world";
import { configureItem, spawnItem } from "$lib/server/crossover";
import { fetchEntity, initializeClients } from "$lib/server/crossover/redis";
import type {
    Item,
    ItemEntity,
    Player,
    PlayerEntity,
} from "$lib/server/crossover/redis/entities";
import { sleep } from "$lib/utils";
import ngeohash from "ngeohash";
import { expect, test } from "vitest";
import type { UpdateEntitiesEvent } from "../../src/routes/api/crossover/stream/+server";
import { getRandomRegion } from "../utils";
import {
    buffEntity,
    createRandomPlayer,
    flushEventChannel,
    generateRandomGeohash,
    testPlayerUseItem,
    waitForEventData,
} from "./utils";

test("Test Player", async () => {
    await initializeClients(); // create redis repositories

    const region = String.fromCharCode(...getRandomRegion());

    // Create players
    const playerOneName = "Gandalf";
    const playerOneGeohash = generateRandomGeohash(6, "h9");
    let [playerOneWallet, playerOneCookies, playerOne] =
        await createRandomPlayer({
            region,
            geohash: playerOneGeohash,
            name: playerOneName,
        });
    expect(playerOne.loc[0].length).toBe(worldSeed.spatial.unit.precision);
    expect(playerOne.loc[0].startsWith(playerOneGeohash)).toBe(true);

    const playerTwoName = "Saruman";
    const playerTwoGeohash = generateRandomGeohash(6, "h9");
    let [playerTwoWallet, playerTwoCookies, playerTwo] =
        await createRandomPlayer({
            region,
            geohash: playerTwoGeohash,
            name: playerTwoName,
        });
    expect(playerTwo.loc[0].length).toBe(worldSeed.spatial.unit.precision);
    expect(playerTwo.loc[0].startsWith(playerTwoGeohash)).toBe(true);

    const playerThreeName = "Sauron";
    const playerThreeGeohash = playerOneGeohash;
    let [playerThreeWallet, playerThreeCookies, playerThree] =
        await createRandomPlayer({
            region,
            geohash: playerThreeGeohash,
            name: playerThreeName,
        });
    expect(playerThree.loc[0].length).toBe(worldSeed.spatial.unit.precision);
    expect(playerThree.loc[0].startsWith(playerThreeGeohash)).toBe(true);

    // Create streams
    const [playerOneStream, playerOneCloseStream] = await stream({
        Cookie: playerOneCookies,
    });
    await expect(
        waitForEventData(playerOneStream, "feed"),
    ).resolves.toMatchObject({
        type: "system",
        message: "started",
    });
    const [playerTwoStream, playerTwoCloseStream] = await stream({
        Cookie: playerTwoCookies,
    });
    await expect(
        waitForEventData(playerTwoStream, "feed"),
    ).resolves.toMatchObject({
        type: "system",
        message: "started",
    });
    const [playerThreeStream, playerThreeCloseStream] = await stream({
        Cookie: playerThreeCookies,
    });
    await expect(
        waitForEventData(playerThreeStream, "feed"),
    ).resolves.toMatchObject({
        type: "system",
        message: "started",
    });

    // Say
    setTimeout(async () => {
        await crossoverCmdSay(
            { message: "Hello, world!" },
            { Cookie: playerOneCookies },
        );
    }, 0);

    // Say - player three should receive message (same tile)
    await expect(
        waitForEventData(playerThreeStream, "feed"),
    ).resolves.toMatchObject({
        type: "message",
        message: "${origin} says ${message}",
        variables: {
            origin: playerOneWallet.publicKey.toBase58(),
            cmd: "say",
            message: "Hello, world!",
        },
    });

    await expect(
        waitForEventData(playerOneStream, "feed"),
    ).resolves.toMatchObject({
        type: "message",
        message: "${origin} says ${message}",
        variables: {
            origin: playerOneWallet.publicKey.toBase58(),
            cmd: "say",
            message: "Hello, world!",
        },
    });

    // Say - player two should not receive the message (different tile)
    await expect(
        waitForEventData(playerTwoStream, "feed"),
    ).rejects.toThrowError("Timeout occurred while waiting for event");

    // Look - no target
    await crossoverCmdLook({}, { Cookie: playerOneCookies });
    await expect(
        waitForEventData(playerOneStream, "entities"),
    ).resolves.toMatchObject({
        players: [
            {
                player: playerOne.player,
            },
            {
                player: playerThree.player,
            },
        ],
    });
    await sleep(MS_PER_TICK * 2);

    // Move
    await crossoverCmdMove({ path: ["n"] }, { Cookie: playerOneCookies });
    const northTile = ngeohash.neighbor(playerOne.loc[0], [1, 0]);
    await expect(
        waitForEventData(playerOneStream, "entities"),
    ).resolves.toMatchObject({
        players: [
            {
                player: playerOne.player,
                loc: [northTile],
            },
        ],
    });
    await sleep(MS_PER_TICK * 2);
    playerOne = (await fetchEntity(playerOne.player)) as Player;

    // Stats
    expect(playerStats({ level: 1 })).toMatchObject({
        hp: 10,
        mp: 10,
        st: 10,
        ap: 4,
    });
    expect(playerStats({ level: 2 })).toMatchObject({
        hp: 20,
        mp: 20,
        st: 20,
        ap: 4,
    });

    /*
     * Test crossoverCmdPerformAbility
     */

    // Test out of range
    await crossoverCmdPerformAbility(
        {
            target: playerTwo.player,
            ability: abilities.scratch.ability,
        },
        { Cookie: playerOneCookies },
    );
    await expect(
        waitForEventData(playerOneStream, "feed"),
    ).resolves.toMatchObject({
        event: "feed",
        type: "error",
        message: "Target is out of range",
    });
    await sleep(MS_PER_TICK * 2);

    // Test out of resources
    await crossoverCmdPerformAbility(
        {
            target: playerTwo.player,
            ability: abilities.teleport.ability,
        },
        { Cookie: playerOneCookies },
    );
    await expect(
        waitForEventData(playerOneStream, "feed"),
    ).resolves.toMatchObject({
        event: "feed",
        type: "error",
        message: "Not enough mana points to teleport.",
    });
    await sleep(MS_PER_TICK * 2);

    // Buff `playerOne` with enough resources to teleport
    playerOne = (await buffEntity(playerOne.player, {
        level: 10,
        ...playerStats({ level: 10 }),
    })) as Player;

    /*
     * Test ability success (`playerOne` teleport to `playerTwo` location)
     *
     * Note: `playerTwo` is not a target and does not get events
     */
    await crossoverCmdPerformAbility(
        {
            target: playerTwo.player,
            ability: abilities.teleport.ability,
        },
        { Cookie: playerOneCookies },
    );

    await expect(
        waitForEventData(playerOneStream, "entities"),
    ).resolves.toMatchObject({
        event: "entities",
        players: [
            {
                player: playerOne.player,
                name: "Gandalf",
                lgn: true,
                loc: playerOne.loc, // no change yet
                lvl: 10,
                mp: playerOne.mp - abilities.teleport.mp,
                ap: playerOne.ap - abilities.teleport.ap,
                lum: 0,
                umb: 0,
            },
        ],
        monsters: [],
        items: [],
    });

    // `playerOne` update effect
    await expect(
        waitForEventData(playerOneStream, "entities"),
    ).resolves.toMatchObject({
        event: "entities",
        players: [
            {
                player: playerOne.player,
                name: "Gandalf",
                loc: playerTwo.loc,
                lvl: 10,
                mp: playerOne.mp - abilities.teleport.mp,
                ap: playerOne.ap - abilities.teleport.ap,
            },
            {
                player: playerTwo.player,
                name: "Saruman",
            },
        ],
        monsters: [],
        items: [],
    });
    await sleep(MS_PER_TICK * 2);
    playerOne = (await fetchEntity(playerOne.player)) as Player;

    /*
     * Test crossoverCmdConfigureItem
     */

    // Spawn woodendoor at playerOne location
    let woodendoor = (await spawnItem({
        geohash: playerOne.loc[0],
        prop: compendium.woodendoor.prop,
        variables: {
            [compendium.woodendoor.variables.doorsign.variable]:
                "A custom door sign",
        },
    })) as Item;
    expect(woodendoor).toMatchObject({
        state: "closed",
        vars: { doorsign: "A custom door sign" },
    });

    // Configure woodendoor
    await crossoverCmdConfigureItem(
        {
            item: woodendoor.item,
            variables: {
                [compendium.woodendoor.variables.doorsign.variable]:
                    "A new door sign",
            },
        },
        { Cookie: playerOneCookies },
    );
    await sleep(MS_PER_TICK * 2);
    woodendoor = (await fetchEntity(woodendoor.item)) as Item;
    expect(woodendoor).toMatchObject({
        state: "closed",
        vars: { doorsign: "A new door sign" },
    });

    /*
     * Test `crossoverCmdUseItem` (open woodendoor)
     */

    var [result, { self, selfBefore, item, itemBefore }] =
        await testPlayerUseItem({
            self: playerOne,
            item: woodendoor,
            utility: compendium.woodendoor.utilities.open.utility,
            cookies: playerOneCookies,
            stream: playerOneStream,
        });
    await sleep(MS_PER_TICK * 2);

    // Check item attributes
    expect(itemAttibutes(item)).toMatchObject({
        destructible: false,
        description: "A new door sign. The door is open.",
        variant: "default",
    });

    /*
     * Test `crossoverCmdUseItem` (use portal)
     */

    // Move playerOne south (to spawn portal without colliding with woodendoor)
    await crossoverCmdMove({ path: ["s"] }, { Cookie: playerOneCookies });
    await sleep(MS_PER_TICK * 2);
    playerOne = (await fetchEntity(playerOne.player)) as Player;

    // Spawn portals (dm)
    let portalOne = (await spawnItem({
        geohash: playerOne.loc[0], // spawn at playerOne
        prop: compendium.portal.prop,
    })) as Item;
    let portalTwo = (await spawnItem({
        geohash: generateRandomGeohash(8, "h9"), // spawn portalTwo somewhere else
        prop: compendium.portal.prop,
    })) as Item;

    // Configure portals (dm)
    await configureItem({
        self: playerOne as PlayerEntity,
        item: portalOne as ItemEntity,
        variables: {
            target: portalTwo.item,
        },
    });
    await sleep(MS_PER_TICK * 2);
    await configureItem({
        self: playerOne as PlayerEntity,
        item: portalTwo as ItemEntity,
        variables: {
            target: portalOne.item,
        },
    });
    await sleep(MS_PER_TICK * 2);

    // `playerOne` use `portalOne` to teleport to `portalTwo`
    await crossoverCmdUseItem(
        {
            item: portalOne.item,
            utility: compendium.portal.utilities.teleport.utility,
        },
        { Cookie: playerOneCookies },
    );

    // Check `playerOne` received `portalOne` start state
    await expect(
        waitForEventData(playerOneStream, "entities"),
    ).resolves.toMatchObject({
        event: "entities",
        players: [
            {
                player: playerOne.player,
            },
        ],
        monsters: [],
        items: [
            {
                item: portalOne.item,
                state: "default",
            },
        ],
    });

    // Check `playerOne` received effect
    expect(
        waitForEventData(playerOneStream, "entities"),
    ).resolves.toMatchObject({
        event: "entities",
        players: [
            {
                player: playerOne.player,
                loc: [portalTwo.loc[0]],
                locT: "geohash",
            },
        ],
        monsters: [],
        items: [
            {
                item: portalTwo.item, // this is the target
                dur: 100,
                chg: 100,
                state: "default",
            },
        ],
    });

    console.log(
        JSON.stringify(
            await waitForEventData(playerOneStream, "entities"),
            null,
            2,
        ),
    );

    console.log(
        JSON.stringify(
            await waitForEventData(playerOneStream, "entities"),
            null,
            2,
        ),
    );

    // TODO: investigate why there is an extra event

    // Check `playerOne` received `portalTwo` end state
    await expect(
        waitForEventData(playerOneStream, "entities"),
    ).resolves.toMatchObject({
        event: "entities",
        players: [
            {
                player: playerOne.player,
            },
        ],
        monsters: [],
        items: [
            {
                item: portalOne.item,
                dur: 100,
                chg: 99, // -1
            },
        ],
    });

    await sleep(MS_PER_TICK * 2);

    // Update `playerOne`
    playerOne = (await fetchEntity(playerOne.player)) as Player;

    // Update `portalOne`
    portalOne = (await fetchEntity(portalOne.item)) as Item;

    // Check `playerOne` location after teleport
    expect(playerOne.loc[0]).toBe(portalTwo.loc[0]);

    // `playerOne` teleport back to `portalOne`
    setTimeout(async () => {
        await crossoverCmdUseItem(
            {
                item: portalTwo.item,
                utility: compendium.portal.utilities.teleport.utility,
            },
            { Cookie: playerOneCookies },
        );
    }, 0);

    // Check `playerOne` received `portalTwo` start state
    await expect(
        waitForEventData(playerOneStream, "entities"),
    ).resolves.toMatchObject({
        event: "entities",
        players: [
            {
                player: playerOne.player,
            },
        ],
        monsters: [],
        items: [
            {
                item: portalTwo.item,
                state: "default",
            },
        ],
    });

    // Check `playerOne` received effect
    await expect(
        waitForEventData(playerOneStream, "entities"),
    ).resolves.toMatchObject({
        event: "entities",
        players: [
            {
                player: playerOne.player,
            },
        ],
        monsters: [],
        items: [
            {
                item: portalOne.item, // this is thet target
                dur: 100,
                chg: 99,
            },
        ],
    });

    // Check `playerOne` received `portalTwo` end state
    await expect(
        waitForEventData(playerOneStream, "entities"),
    ).resolves.toMatchObject({
        event: "entities",
        players: [
            {
                player: playerOne.player,
            },
        ],
        monsters: [],
        items: [
            {
                item: portalTwo.item,
                dur: 100,
                chg: 99, // -1
            },
        ],
    });

    // Update `playerOne`
    playerOne = (await fetchEntity(playerOne.player)) as Player;

    // Update `portalTwo`
    portalTwo = (await fetchEntity(portalTwo.item)) as Item;

    // Check `playerOne` location after teleport
    expect(playerOne.loc[0]).toBe(portalOne.loc[0]);

    console.log("asd");

    /*
     * Test crossoverCmdCreateItem
     */
    await flushEventChannel(playerOneStream, "entities");
    await flushEventChannel(playerOneStream, "feed");
    await sleep(MS_PER_TICK * 2);

    await crossoverCmdCreateItem(
        {
            geohash: playerOne.loc[0],
            prop: compendium.woodenclub.prop,
        },
        { Cookie: playerOneCookies },
    );
    await sleep(MS_PER_TICK * 2);

    // Check `playerOne` received `entities` event
    const woodenclub = (
        (await waitForEventData(playerOneStream, "entities")) as any
    ).items[0];

    expect(woodenclub).toMatchObject({
        name: "Wooden Club",
        prop: "woodenclub",
        loc: playerOne.loc,
        dur: 100,
        chg: 0,
        own: playerOne.player, // playerOne owns the woodenclub
        cfg: playerOne.player, // playerOne can configure the woodenclub
        state: "default",
        vars: {},
        dbuf: [],
        buf: [],
    });

    /*
     * Test `useItem` permissions
     */

    // Take & Equip woodenclub
    await crossoverCmdTake(
        { item: woodenclub.item },
        { Cookie: playerOneCookies },
    );
    await crossoverCmdEquip(
        { item: woodenclub.item, slot: "rh" },
        { Cookie: playerOneCookies },
    );

    // Teleport to playerTwo's location to be in range
    await crossoverCmdPerformAbility(
        {
            target: playerTwo.player,
            ability: abilities.teleport.ability,
        },
        { Cookie: playerOneCookies },
    );
    await waitForEventData(playerOneStream, "entities"); // consume update resources
    var abilityResult = (await waitForEventData(
        playerOneStream,
        "entities",
    )) as UpdateEntitiesEvent;
    for (const p of abilityResult.players || []) {
        if (p.player === playerOne.player) {
            playerOne = p;
        }
    }

    // TODO: Find a better way to test busy (dev environment is set as 10ms per tick)
    //
    // // Test `playerOne` busy
    // setTimeout(async () => {
    //     crossoverCmdUseItem(
    //         {
    //             item: woodenclub.item,
    //             utility: compendium.woodenclub.utilities.swing.utility,
    //             target: playerTwo.player,
    //         },
    //         { Cookie: playerOneCookies },
    //     );
    // }, 0);
    // await expect(
    //     waitForEventData(playerOneStream, "feed"),
    // ).resolves.toMatchObject({
    //     event: "feed",
    //     type: "message",
    //     message: "Player is busy",
    // });

    // Use woodenclub (swing)
    let stBefore = playerOne.st;
    let apBefore = playerOne.ap;

    await crossoverCmdUseItem(
        {
            item: woodenclub.item,
            utility: compendium.woodenclub.utilities.swing.utility,
            target: playerTwo.player,
        },
        { Cookie: playerOneCookies },
    );

    // Consume item state event
    await waitForEventData(playerOneStream, "entities");

    // Check effect event
    var swingResult = (await waitForEventData(
        playerOneStream,
        "entities",
    )) as UpdateEntitiesEvent;

    expect(swingResult).toMatchObject({
        event: "entities",
        players: [
            {
                player: playerOne.player,
                st: stBefore, // uses item charge not player's resources
            },
            {
                player: playerTwo.player,
                hp: 9, // -1
            },
        ],
        monsters: [],
        items: [],
    });
});
