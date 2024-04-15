import { INTERNAL_SERVICE_KEY } from "$env/static/private";
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
import { itemAttibutes } from "$lib/crossover/world/compendium";
import { playerStats } from "$lib/crossover/world/player";
import {
    abilities,
    compendium,
    worldSeed,
} from "$lib/crossover/world/settings";
import { configureItem, spawnItem } from "$lib/server/crossover";
import type {
    ItemEntity,
    PlayerEntity,
} from "$lib/server/crossover/redis/entities";
import { groupBy } from "lodash";
import ngeohash from "ngeohash";
import { expect, test, vi } from "vitest";
import { getRandomRegion } from "../utils";
import {
    createRandomPlayer,
    generateRandomGeohash,
    waitForEventData,
} from "./utils";

vi.mock("$lib/crossover/world", async (module) => {
    return { ...((await module()) as object), MS_PER_TICK: 10 };
});

test("Test Player", async () => {
    const region = String.fromCharCode(...getRandomRegion());

    // Player one
    const playerOneName = "Gandalf";
    const playerOneGeohash = generateRandomGeohash(6, "h9");
    let [playerOneWallet, playerOneCookies, playerOne] =
        await createRandomPlayer({
            region,
            geohash: playerOneGeohash,
            name: playerOneName,
        });
    expect(playerOne.location[0].length).toBe(worldSeed.spatial.unit.precision);
    expect(playerOne.location[0].startsWith(playerOneGeohash)).toBe(true);

    // Player two
    const playerTwoName = "Saruman";
    const playerTwoGeohash = generateRandomGeohash(6, "h9");
    let [playerTwoWallet, playerTwoCookies, playerTwo] =
        await createRandomPlayer({
            region,
            geohash: playerTwoGeohash,
            name: playerTwoName,
        });
    expect(playerTwo.location[0].length).toBe(worldSeed.spatial.unit.precision);
    expect(playerTwo.location[0].startsWith(playerTwoGeohash)).toBe(true);

    // Player three
    const playerThreeName = "Sauron";
    const playerThreeGeohash = playerOneGeohash;
    let [playerThreeWallet, playerThreeCookies, playerThree] =
        await createRandomPlayer({
            region,
            geohash: playerThreeGeohash,
            name: playerThreeName,
        });
    expect(playerThree.location[0].length).toBe(
        worldSeed.spatial.unit.precision,
    );
    expect(playerThree.location[0].startsWith(playerThreeGeohash)).toBe(true);

    // Stream endpoint
    const [playerOneEventStream, playerOneCloseStream] = await stream({
        Cookie: playerOneCookies,
    });
    await expect(
        waitForEventData(playerOneEventStream, "feed"),
    ).resolves.toMatchObject({
        type: "system",
        message: "started",
    });
    const [playerTwoEventStream, playerTwoCloseStream] = await stream({
        Cookie: playerTwoCookies,
    });
    await expect(
        waitForEventData(playerTwoEventStream, "feed"),
    ).resolves.toMatchObject({
        type: "system",
        message: "started",
    });
    const [playerThreeEventStream, playerThreeCloseStream] = await stream({
        Cookie: playerThreeCookies,
    });
    await expect(
        waitForEventData(playerThreeEventStream, "feed"),
    ).resolves.toMatchObject({
        type: "system",
        message: "started",
    });

    // Say
    await crossoverCmdSay(
        { message: "Hello, world!" },
        { Cookie: playerOneCookies },
    );
    await expect(
        waitForEventData(playerOneEventStream, "feed"),
    ).resolves.toMatchObject({
        type: "message",
        message: "${origin} says ${message}",
        variables: {
            origin: playerOneWallet.publicKey.toBase58(),
            cmd: "say",
            message: "Hello, world!",
        },
    });

    // Say - player three should receive message (same tile)
    await expect(
        waitForEventData(playerThreeEventStream, "feed"),
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
        waitForEventData(playerTwoEventStream, "feed"),
    ).rejects.toThrowError("Timeout occurred while waiting for event");

    // Look - no target (tile)
    let lookAtResult = await crossoverCmdLook({}, { Cookie: playerOneCookies });
    expect(lookAtResult.tile).toMatchObject({
        geohash: playerOne.location[0],
    });
    expect(groupBy(lookAtResult.players, "player")).contains.keys([
        playerOneWallet.publicKey.toBase58(),
        playerThreeWallet.publicKey.toBase58(),
    ]);

    // Move
    const nextLocation = (
        await crossoverCmdMove({ direction: "n" }, { Cookie: playerOneCookies })
    ).players?.[0].location!;
    const northTile = ngeohash.neighbor(playerOne.location[0], [1, 0]);
    expect(nextLocation[0]).toEqual(northTile);

    // Stats
    expect(playerStats({ level: 1 })).toMatchObject({
        hp: 10,
        mp: 10,
        st: 10,
        ap: 10,
    });
    expect(playerStats({ level: 2 })).toMatchObject({
        hp: 20,
        mp: 20,
        st: 20,
        ap: 20,
    });

    /*
     * Test crossoverCmdPerformAbility
     */

    // Test out of range
    var { status, message } = await crossoverCmdPerformAbility(
        {
            target: playerTwo.player,
            ability: abilities.scratch.ability,
        },
        { Cookie: playerOneCookies },
    );
    expect(status).toBe("failure");
    expect(message).toBe("Target out of range");

    // Test out of resources
    var { status, message } = await crossoverCmdPerformAbility(
        {
            target: playerTwo.player,
            ability: abilities.teleport.ability,
        },
        { Cookie: playerOneCookies },
    );
    expect(status).toBe("failure");
    expect(message).toBe("Not enough resources to perform ability");

    // Buff entity with enough resources to teleport
    let res = await fetch(
        "http://localhost:5173/trpc/crossover.world.buffEntity",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${INTERNAL_SERVICE_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                entity: playerOne.player,
                hp: 100,
                mp: 100,
                st: 100,
                ap: 100,
            }),
        },
    );
    expect(res.status).toBe(200);

    // Test ability success
    let abilityResult = await crossoverCmdPerformAbility(
        {
            target: playerTwo.player,
            ability: abilities.teleport.ability,
        },
        { Cookie: playerOneCookies },
    );
    expect(abilityResult).toMatchObject({
        players: [
            {
                player: playerOne.player,
                name: "Gandalf",
                loggedIn: true,
                location: playerTwo.location, // teleported to playerTwo location
                level: 1,
                hp: 100,
                mp: 80,
                st: 100,
                ap: 90,
            },
            {
                player: playerTwo.player,
                name: "Saruman",
                loggedIn: true,
                location: playerTwo.location,
                level: 1,
                hp: 10,
                mp: 10,
                st: 10,
                ap: 10,
            },
        ],
        status: "success",
        op: "upsert",
        message: "",
    });
    for (const p of abilityResult.players || []) {
        if (p.player === playerOne.player) {
            playerOne = p;
        }
    }

    /*
     * Test crossoverCmdConfigureItem
     */

    // Spawn woodendoor at playerOne location
    let woodendoor = (await spawnItem({
        geohash: playerOne.location[0],
        prop: compendium.woodendoor.prop,
        variables: {
            [compendium.woodendoor.variables.doorSign.variable]:
                "A custom door sign",
        },
    })) as ItemEntity;
    expect(woodendoor).toMatchObject({
        state: "closed",
        variables: { doorSign: "A custom door sign" },
    });

    // Configure woodendoor
    woodendoor = (
        await crossoverCmdConfigureItem(
            {
                item: woodendoor.item,
                variables: {
                    [compendium.woodendoor.variables.doorSign.variable]:
                        "A new door sign",
                },
            },
            { Cookie: playerOneCookies },
        )
    ).items?.[0]!;
    expect(woodendoor).toMatchObject({
        state: "closed",
        variables: { doorSign: "A new door sign" },
    });

    /*
     * Test crossoverCmdUseItem
     */

    // Use woodendoor (open)
    var useItemRes = await crossoverCmdUseItem(
        {
            item: woodendoor.item,
            utility: compendium.woodendoor.utilities.open.utility,
        },
        { Cookie: playerOneCookies },
    );
    expect(useItemRes).toMatchObject({
        items: [
            {
                item: woodendoor.item,
                name: "Wooden Door",
                prop: "woodendoor",
                location: woodendoor.location,
                state: "open",
                variables: { doorSign: "A new door sign" },
            },
        ],
        status: "success",
    });
    woodendoor = useItemRes.items?.[0]!;
    expect(itemAttibutes(woodendoor)).toMatchObject({
        destructible: false,
        description: "A new door sign. The door is open.",
        variant: "default",
    });

    // Move playerOne south (to spawn portal without colliding with woodendoor)
    playerOne.location = (
        await crossoverCmdMove({ direction: "s" }, { Cookie: playerOneCookies })
    ).players?.[0].location!;

    // Spawn portals (dm)
    const portalOne = (await spawnItem({
        geohash: playerOne.location[0], // spawn at playerOne
        prop: compendium.portal.prop,
    })) as ItemEntity;
    const portalTwo = (await spawnItem({
        geohash: generateRandomGeohash(8), // spawn portalTwo somewhere else
        prop: compendium.portal.prop,
    })) as ItemEntity;

    // Configure portals (dm)
    await configureItem({
        self: playerOne as PlayerEntity,
        item: portalOne,
        variables: {
            target: portalTwo.item,
        },
    });
    await configureItem({
        self: playerOne as PlayerEntity,
        item: portalTwo,
        variables: {
            target: portalOne.item,
        },
    });

    // Use portals (player)
    playerOne = (
        await crossoverCmdUseItem(
            {
                item: portalOne.item,
                utility: compendium.portal.utilities.teleport.utility,
            },
            { Cookie: playerOneCookies },
        )
    ).players?.[0]!;

    // Teleport to portalTwo
    expect(playerOne.location[0]).toBe(portalTwo.location[0]);
    playerOne = (
        await crossoverCmdUseItem(
            {
                item: portalTwo.item,
                utility: compendium.portal.utilities.teleport.utility,
            },
            { Cookie: playerOneCookies },
        )
    ).players?.[0]!;

    // Teleport back to portalOne
    expect(playerOne.location[0]).toBe(portalOne.location[0]);

    /*
     * Test crossoverCmdCreateItem
     */

    const woodenclub = (
        await crossoverCmdCreateItem(
            {
                geohash: playerOne.location[0],
                prop: compendium.woodenclub.prop,
            },
            { Cookie: playerOneCookies },
        )
    ).items?.[0]!;

    expect(woodenclub).toMatchObject({
        name: "Wooden Club",
        prop: "woodenclub",
        location: playerOne.location,
        durability: 100,
        charges: 0,
        owner: playerOne.player, // playerOne owns the woodenclub
        configOwner: playerOne.player, // playerOne can configure the woodenclub
        state: "default",
        variables: {},
        debuffs: [],
        buffs: [],
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
    var { players } = await crossoverCmdPerformAbility(
        {
            target: playerTwo.player,
            ability: abilities.teleport.ability,
        },
        { Cookie: playerOneCookies },
    );
    for (const p of players || []) {
        if (p.player === playerOne.player) {
            playerOne = p;
        }
    }

    // Use woodenclub (swing)
    let stBefore = playerOne.st;
    let apBefore = playerOne.ap;
    await expect(
        crossoverCmdUseItem(
            {
                item: woodenclub.item,
                utility: compendium.woodenclub.utilities.swing.utility,
                target: playerTwo.player,
            },
            { Cookie: playerOneCookies },
        ),
    ).resolves.toMatchObject({
        players: [
            {
                player: playerOne.player,
                st: stBefore, // uses item charge not player's resources
                ap: apBefore, // uses item charge not player's resources
            },
            {
                player: playerTwo.player,
                hp: 9,
            },
        ],
        items: [
            {
                item: woodenclub.item,
                durability: 99, // -1 durability
                charges: 0,
            },
        ],
        status: "success",
        op: "upsert",
    });
});
