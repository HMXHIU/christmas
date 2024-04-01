import { INTERNAL_SERVICE_KEY } from "$env/static/private";
import {
    commandConfigureItem,
    commandCreateItem,
    commandLook,
    commandMove,
    commandPerformAbility,
    commandSay,
    commandUseItem,
    stream,
} from "$lib/crossover";
import { worldSeed } from "$lib/crossover/world";
import { abilities } from "$lib/crossover/world/abilities";
import { compendium, itemAttibutes } from "$lib/crossover/world/compendium";
import { playerStats } from "$lib/crossover/world/player";
import { configureItem, spawnItem } from "$lib/server/crossover";
import type {
    ItemEntity,
    PlayerEntity,
} from "$lib/server/crossover/redis/entities";
import { groupBy } from "lodash";
import ngeohash from "ngeohash";
import { expect, test, vi } from "vitest";
import { getRandomRegion } from "../utils";
import { createRandomPlayer, waitForEventData } from "./utils";

vi.mock("$lib/crossover/world", async (module) => {
    return { ...((await module()) as object), MS_PER_TICK: 10 };
});

test("Test Player", async () => {
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
    expect(playerOne.location[0].length).toBe(worldSeed.spatial.unit.precision);
    expect(playerOne.location[0].startsWith(playerOneGeohash)).toBe(true);

    // Player two
    const playerTwoName = "Saruman";
    const playerTwoGeohash = "gbsuv8";
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
    const playerThreeGeohash = "gbsuv7";
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
        waitForEventData(playerOneEventStream, "system"),
    ).resolves.toMatchObject({
        type: "system",
        message: "started",
    });
    const [playerTwoEventStream, playerTwoCloseStream] = await stream({
        Cookie: playerTwoCookies,
    });
    await expect(
        waitForEventData(playerTwoEventStream, "system"),
    ).resolves.toMatchObject({
        type: "system",
        message: "started",
    });
    const [playerThreeEventStream, playerThreeCloseStream] = await stream({
        Cookie: playerThreeCookies,
    });
    await expect(
        waitForEventData(playerThreeEventStream, "system"),
    ).resolves.toMatchObject({
        type: "system",
        message: "started",
    });

    // Say
    await commandSay(
        { message: "Hello, world!" },
        { Cookie: playerOneCookies },
    );
    await expect(
        waitForEventData(playerOneEventStream, "message"),
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
        waitForEventData(playerThreeEventStream, "message"),
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
        waitForEventData(playerTwoEventStream, "message"),
    ).rejects.toThrowError("Timeout occurred while waiting for event");

    // Look - no target (tile)
    let lookAtResult = await commandLook({}, { Cookie: playerOneCookies });
    expect(lookAtResult.tile).toMatchObject({
        geohash: playerOne.location[0],
    });
    expect(groupBy(lookAtResult.players, "player")).contains.keys([
        playerOneWallet.publicKey.toBase58(),
        playerThreeWallet.publicKey.toBase58(),
    ]);

    // Move
    const nextTile = await commandMove(
        { direction: "n" },
        { Cookie: playerOneCookies },
    );
    const northTile = ngeohash.neighbor(playerOne.location[0], [1, 0]);
    expect(nextTile).toEqual(northTile);

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
     * Test commandPerformAbility
     */

    // Test out of range
    var { status, message } = await commandPerformAbility(
        {
            target: playerTwo.player,
            ability: abilities.scratch.ability,
        },
        { Cookie: playerOneCookies },
    );
    expect(status).toBe("failure");
    expect(message).toBe("Target out of range");

    // Test out of resources
    var { status, message } = await commandPerformAbility(
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
    let abilityResult = await commandPerformAbility(
        {
            target: playerTwo.player,
            ability: abilities.teleport.ability,
        },
        { Cookie: playerOneCookies },
    );
    playerOne = abilityResult.self;
    expect(abilityResult).toMatchObject({
        self: {
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
        target: {
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
        status: "success",
        message: "",
    });

    /*
     * Test commandConfigureItem
     */

    // Spawn woodenDoor
    let woodenDoor = (await spawnItem({
        geohash: playerOne.location[0],
        prop: compendium.woodenDoor.prop,
        variables: {
            [compendium.woodenDoor.variables.doorSign.variable]:
                "A custom door sign",
        },
    })) as ItemEntity;
    expect(woodenDoor).toMatchObject({
        state: "closed",
        variables: '{"doorSign":"A custom door sign"}',
    });

    // Configure woodenDoor
    woodenDoor = (
        await commandConfigureItem(
            {
                item: woodenDoor.item,
                variables: {
                    [compendium.woodenDoor.variables.doorSign.variable]:
                        "A new door sign",
                },
            },
            { Cookie: playerOneCookies },
        )
    ).item;
    expect(woodenDoor).toMatchObject({
        state: "closed",
        variables: '{"doorSign":"A new door sign"}',
    });

    /*
     * Test commandUseItem
     */

    // Use woodenDoor (open)
    var { item, status } = await commandUseItem(
        {
            item: woodenDoor.item,
            action: compendium.woodenDoor.actions.open.action,
        },
        { Cookie: playerOneCookies },
    );
    expect(status).toBe("success");
    expect(item).toMatchObject({
        item: woodenDoor.item,
        name: "Wooden Door",
        prop: "woodenDoor",
        location: woodenDoor.location,
        state: "open",
        variables: '{"doorSign":"A new door sign"}',
    });
    woodenDoor = item as ItemEntity;
    expect(itemAttibutes(woodenDoor)).toMatchObject({
        traversable: 1,
        destructible: false,
        description: "A new door sign. The door is open.",
        variant: "default",
    });

    // Spawn portals (dm)
    const portalOne = (await spawnItem({
        geohash: playerOne.location[0], // spawn at playerOne
        prop: compendium.portal.prop,
    })) as ItemEntity;
    const somwhereGeohash = "w21z3muk";
    const portalTwo = (await spawnItem({
        geohash: somwhereGeohash, // spawn at somwhere
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
        await commandUseItem(
            {
                item: portalOne.item,
                action: compendium.portal.actions.teleport.action,
            },
            { Cookie: playerOneCookies },
        )
    ).self;

    // Teleport to portalTwo
    expect(playerOne.location[0]).toBe(portalTwo.location[0]);
    playerOne = (
        await commandUseItem(
            {
                item: portalTwo.item,
                action: compendium.portal.actions.teleport.action,
            },
            { Cookie: playerOneCookies },
        )
    ).self;

    // Teleport back to portalOne
    expect(playerOne.location[0]).toBe(portalOne.location[0]);

    /*
     * Test commandCreateItem
     */

    const woodenClub = await commandCreateItem(
        {
            geohash: playerOne.location[0],
            prop: compendium.woodenClub.prop,
        },
        { Cookie: playerOneCookies },
    );
    expect(woodenClub).toMatchObject({
        name: "Wooden Club",
        prop: "woodenClub",
        location: playerOne.location,
        durability: 100,
        charges: 0,
        owner: playerOne.player, // playerOne owns the woodenClub
        configOwner: playerOne.player, // playerOne can configure the woodenClub
        state: "default",
        variables: "{}",
        debuffs: [],
        buffs: [],
    });

    /*
     * Test `useItem` permissions
     */
    let stBefore = playerOne.st;
    let apBefore = playerOne.ap;
    var { status, message, self, target, item } = await commandUseItem(
        {
            item: woodenClub.item,
            action: compendium.woodenClub.actions.swing.action,
            target: playerTwo.player,
        },
        { Cookie: playerOneCookies },
    );

    expect(status).toBe("success");
    expect(target).toMatchObject({
        player: playerTwo.player,
        hp: 9,
    });
    expect(self).toMatchObject({
        player: playerOne.player,
        st: stBefore, // uses item charge not player's resources
        ap: apBefore, // uses item charge not player's resources
    });
    expect(item).toMatchObject({
        item: woodenClub.item,
        durability: 99, // -1 durability
        charges: 0,
    });
});
