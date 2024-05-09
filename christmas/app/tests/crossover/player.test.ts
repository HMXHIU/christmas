import { INTERNAL_SERVICE_KEY } from "$env/static/private";
import {
    crossoverAuthPlayer,
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
import type { WorldAssetMetadata } from "$lib/crossover/world";
import { itemAttibutes } from "$lib/crossover/world/compendium";
import { playerStats } from "$lib/crossover/world/player";
import {
    TILE_HEIGHT,
    TILE_WIDTH,
    abilities,
    compendium,
    worldSeed,
} from "$lib/crossover/world/settings";
import { configureItem, spawnItem, spawnWorld } from "$lib/server/crossover";
import type {
    Item,
    ItemEntity,
    PlayerEntity,
} from "$lib/server/crossover/redis/entities";
import { groupBy } from "lodash";
import ngeohash from "ngeohash";
import { expect, test, vi } from "vitest";
import type { UpdateEntitiesEvent } from "../../src/routes/api/crossover/stream/+server";
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

    // Create players
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
    playerOne.location = nextLocation;

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
    setTimeout(async () => {
        await crossoverCmdPerformAbility(
            {
                target: playerTwo.player,
                ability: abilities.scratch.ability,
            },
            { Cookie: playerOneCookies },
        );
    }, 0);
    await expect(
        waitForEventData(playerOneStream, "feed"),
    ).resolves.toMatchObject({
        event: "feed",
        type: "message",
        message: "Target is out of range",
    });

    // Test out of resources
    setTimeout(async () => {
        await crossoverCmdPerformAbility(
            {
                target: playerTwo.player,
                ability: abilities.teleport.ability,
            },
            { Cookie: playerOneCookies },
        );
    }, 0);
    await expect(
        waitForEventData(playerOneStream, "feed"),
    ).resolves.toMatchObject({
        event: "feed",
        type: "message",
        message: "Not enough mana points to teleport.",
    });

    // Buff `playerOne` with enough resources to teleport
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
                level: 10,
                ...playerStats({ level: 10 }),
            }),
        },
    );
    expect(res.status).toBe(200);

    /*
     * Test ability success (`playerOne` teleport to `playerTwo` location)
     *
     * Note: `playerTwo` is not a target and does not get events
     */
    setTimeout(async () => {
        await crossoverCmdPerformAbility(
            {
                target: playerTwo.player,
                ability: abilities.teleport.ability,
            },
            { Cookie: playerOneCookies },
        );
    }, 0);

    // `playerOne` update resources
    playerOne = (await crossoverAuthPlayer({
        Cookie: playerOneCookies,
    })) as PlayerEntity;

    await expect(
        waitForEventData(playerOneStream, "entities"),
    ).resolves.toMatchObject({
        event: "entities",
        players: [
            {
                player: playerOne.player,
                name: "Gandalf",
                loggedIn: true,
                location: playerOne.location, // no change yet
                level: 10,
                mp: playerOne.mp - abilities.teleport.mp,
                ap: playerOne.ap - abilities.teleport.ap,
            },
        ],
        monsters: [],
        items: [],
    });

    // `playerOne` update effect
    var abilityResult = (await waitForEventData(
        playerOneStream,
        "entities",
    )) as UpdateEntitiesEvent;
    expect(abilityResult).toMatchObject({
        event: "entities",
        players: [
            {
                player: playerOne.player,
                name: "Gandalf",
                location: playerTwo.location,
                level: 10,
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
    // Update `playerOne`
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
            [compendium.woodendoor.variables.doorsign.variable]:
                "A custom door sign",
        },
    })) as Item;
    expect(woodendoor).toMatchObject({
        state: "closed",
        variables: { doorsign: "A custom door sign" },
    });

    // Configure woodendoor
    woodendoor = (
        await crossoverCmdConfigureItem(
            {
                item: woodendoor.item,
                variables: {
                    [compendium.woodendoor.variables.doorsign.variable]:
                        "A new door sign",
                },
            },
            { Cookie: playerOneCookies },
        )
    ).items?.[0]!;
    expect(woodendoor).toMatchObject({
        state: "closed",
        variables: { doorsign: "A new door sign" },
    });

    /*
     * Test `crossoverCmdUseItem` (open woodendoor)
     */

    setTimeout(async () => {
        await crossoverCmdUseItem(
            {
                item: woodendoor.item,
                utility: compendium.woodendoor.utilities.open.utility,
            },
            { Cookie: playerOneCookies },
        );
    }, 0);

    // Check `playerOne` received `entities` event setting woodendoor state to `state` state
    await expect(
        waitForEventData(playerOneStream, "entities"),
    ).resolves.toMatchObject({
        event: "entities",
        players: [],
        monsters: [],
        items: [
            {
                item: woodendoor.item,
                state: "closed",
            },
        ],
    });

    // Check `playerOne` received `entities` event setting woodendoor state to `end` state
    var useItemRes = (await waitForEventData(
        playerOneStream,
        "entities",
    )) as UpdateEntitiesEvent;
    await expect(useItemRes).toMatchObject({
        event: "entities",
        players: [],
        monsters: [],
        items: [
            {
                item: woodendoor.item,
                state: "open",
            },
        ],
    });
    woodendoor = useItemRes.items?.[0]!;

    // Check item attributes
    expect(itemAttibutes(woodendoor)).toMatchObject({
        destructible: false,
        description: "A new door sign. The door is open.",
        variant: "default",
    });

    /*
     * Test `crossoverCmdUseItem` (use portal)
     */

    // Move playerOne south (to spawn portal without colliding with woodendoor)
    playerOne.location = (
        await crossoverCmdMove({ direction: "s" }, { Cookie: playerOneCookies })
    ).players?.[0].location!;

    // Spawn portals (dm)
    let portalOne = (await spawnItem({
        geohash: playerOne.location[0], // spawn at playerOne
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
    await configureItem({
        self: playerOne as PlayerEntity,
        item: portalTwo as ItemEntity,
        variables: {
            target: portalOne.item,
        },
    });

    // `playerOne` use `portalOne` to teleport to `portalTwo`
    setTimeout(async () => {
        await crossoverCmdUseItem(
            {
                item: portalOne.item,
                utility: compendium.portal.utilities.teleport.utility,
            },
            { Cookie: playerOneCookies },
        );
    }, 0);

    // Check `playerOne` received `portalOne` start state
    await expect(
        waitForEventData(playerOneStream, "entities"),
    ).resolves.toMatchObject({
        event: "entities",
        players: [],
        monsters: [],
        items: [
            {
                item: portalOne.item,
                state: "default",
            },
        ],
    });

    // Check `playerOne` received effect
    var teleportResult = (await waitForEventData(
        playerOneStream,
        "entities",
    )) as UpdateEntitiesEvent;
    expect(teleportResult).toMatchObject({
        event: "entities",
        players: [
            {
                player: playerOne.player,
                location: [portalTwo.location[0]],
                locT: "geohash",
            },
        ],
        monsters: [],
        items: [
            {
                item: portalTwo.item, // this is the target
                durability: 100,
                charges: 100,
                state: "default",
            },
        ],
    });

    // Update `playerOne`
    for (const p of teleportResult.players || []) {
        if (p.player === playerOne.player) {
            playerOne = p;
        }
    }

    // Check `playerOne` received `portalTwo` end state
    teleportResult = (await waitForEventData(
        playerOneStream,
        "entities",
    )) as UpdateEntitiesEvent;
    expect(teleportResult).toMatchObject({
        event: "entities",
        players: [],
        monsters: [],
        items: [
            {
                item: portalOne.item,

                durability: 100,
                charges: 99, // -1
            },
        ],
    });

    // Update `portalOne`
    for (const i of teleportResult.items || []) {
        if (i.item === portalOne.item) {
            portalOne = i;
        }
    }

    // Check `playerOne` location after teleport
    expect(playerOne.location[0]).toBe(portalTwo.location[0]);

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
        players: [],
        monsters: [],
        items: [
            {
                item: portalTwo.item,
                state: "default",
            },
        ],
    });

    // Check `playerOne` received effect
    teleportResult = (await waitForEventData(
        playerOneStream,
        "entities",
    )) as UpdateEntitiesEvent;
    expect(teleportResult).toMatchObject({
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
                durability: 100,
                charges: 99,
            },
        ],
    });

    // Update `playerOne`
    for (const p of teleportResult.players || []) {
        if (p.player === playerOne.player) {
            playerOne = p;
        }
    }

    // Check `playerOne` received `portalTwo` end state
    teleportResult = (await waitForEventData(
        playerOneStream,
        "entities",
    )) as UpdateEntitiesEvent;
    expect(teleportResult).toMatchObject({
        event: "entities",
        players: [],
        monsters: [],
        items: [
            {
                item: portalTwo.item,
                durability: 100,
                charges: 99, // -1
            },
        ],
    });

    // Update `portalTwo`
    for (const i of teleportResult.items || []) {
        if (i.item === portalTwo.item) {
            portalTwo = i;
        }
    }

    // Check `playerOne` location after teleport
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

    setTimeout(async () => {
        crossoverCmdUseItem(
            {
                item: woodenclub.item,
                utility: compendium.woodenclub.utilities.swing.utility,
                target: playerTwo.player,
            },
            { Cookie: playerOneCookies },
        );
    }, 0);

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

    /*
     * Test `look` returns world
     */

    // Spawn world
    const worldAsset: WorldAssetMetadata = {
        height: 8,
        width: 4,
        tileheight: 128,
        tilewidth: 256,
        layers: [
            {
                data: [
                    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 74, 74, 0, 0, 74, 74,
                    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                ],
                height: 8,
                name: "floor",
                properties: [
                    {
                        name: "collider",
                        type: "bool",
                        value: true,
                    },
                    {
                        name: "interior",
                        type: "bool",
                        value: true,
                    },
                ],
                type: "tilelayer",
                width: 4,
                x: 0,
                y: 0,
            },
        ],
    };
    let world = await spawnWorld({
        asset: worldAsset,
        geohash: playerThreeGeohash,
        tileHeight: TILE_HEIGHT,
        tileWidth: TILE_WIDTH,
    });
    var result = await crossoverCmdLook({}, { Cookie: playerThreeCookies });
    expect(result.worlds).toMatchObject([
        {
            world: world.world,
            url: world.url,
        },
    ]);
});
