import { crossoverWorldWorlds } from "$lib/crossover/client";
import { childrenGeohashes, geohashNeighbour } from "$lib/crossover/utils";
import {
    LOCATION_INSTANCE,
    TILE_HEIGHT,
    TILE_WIDTH,
} from "$lib/crossover/world/settings";
import { compendium } from "$lib/crossover/world/settings/compendium";
import { worldSeed } from "$lib/crossover/world/settings/world";
import type { WorldAssetMetadata } from "$lib/crossover/world/types";
import {
    poisInWorld,
    traversableCellsInWorld,
    traversableSpeedInWorld,
} from "$lib/crossover/world/world";
import {
    spawnItemAtGeohash,
    spawnWorld,
    spawnWorldPOIs,
} from "$lib/server/crossover/dm";
import {
    itemRepository,
    monsterRepository,
    worldRepository,
} from "$lib/server/crossover/redis";
import { worldsInGeohashQuerySet } from "$lib/server/crossover/redis/queries";
import type { ItemEntity, WorldEntity } from "$lib/server/crossover/types";
import { sleep } from "$lib/utils";
import { beforeAll, describe, expect, test } from "vitest";
import { worldRecord } from "../../../src/store";
import {
    createGandalfSarumanSauron,
    createWorldAsset,
    generateRandomGeohash,
} from "../utils";

describe("World Tests", async () => {
    let { playerOneCookies } = await createGandalfSarumanSauron();

    let woodenDoor = (await spawnItemAtGeohash({
        geohash: generateRandomGeohash(8, "h9"),
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        prop: compendium.woodendoor.prop,
        variables: {
            [compendium.woodendoor.variables!.doorsign.variable]:
                "A custom door sign",
        },
    })) as ItemEntity;

    let assetUrl: string;
    let asset: WorldAssetMetadata;
    let world: WorldEntity;
    let worldGeohash: string;
    let worldTwo: WorldEntity;
    let worldTwoGeohash: string;
    let worldThree: WorldEntity;
    let worldThreeGeohash: string;

    beforeAll(async () => {
        // Store the test world asset in storage and get the url
        const worldAsset = await createWorldAsset();
        asset = worldAsset.asset;
        assetUrl = worldAsset.url;

        // Remove all worlds in test area
        const existingWorlds = await worldsInGeohashQuerySet(
            ["w21z", "gbsu", "y78j"],
            "geohash",
        ).all();
        worldRepository.remove(
            existingWorlds.map((w) => (w as WorldEntity).world),
        );
        await sleep(1000);

        // Spawn worlds
        worldGeohash = "w21z8ucp"; // top left plot
        world = await spawnWorld({
            assetUrl,
            geohash: worldGeohash,
            locationType: "geohash",
            tileHeight: asset.tileheight,
            tileWidth: asset.tilewidth,
        });
        worldTwoGeohash = "y78jdmsq";
        worldTwo = await spawnWorld({
            assetUrl,
            geohash: worldTwoGeohash,
            locationType: "geohash",
            tileHeight: asset.tileheight / 2, // 128 / 2 = 64
            tileWidth: asset.tilewidth / 2, // 256 / 2 = 128
        });
        worldThreeGeohash = "gbsuv7xp";
        worldThree = await spawnWorld({
            assetUrl,
            geohash: worldThreeGeohash,
            locationType: "geohash",
            tileHeight: TILE_HEIGHT,
            tileWidth: TILE_WIDTH,
        });

        // Set worldRecord
        worldRecord.set({
            [worldGeohash.slice(-2)]: {
                [world.world]: world,
            },
            [worldTwoGeohash.slice(-2)]: {
                [worldTwo.world]: worldTwo,
            },
            [worldThreeGeohash.slice(-2)]: {
                [worldThree.world]: worldThree,
            },
        });
    });

    test("Test traversableCellsInWorld", async () => {
        // Test when cell dimensions == tile dimensions
        let traversableCells = await traversableCellsInWorld({
            world,
            tileHeight: asset.tileheight,
            tileWidth: asset.tilewidth,
        });
        expect(traversableCells).toMatchObject({
            "1,3": 0,
            "1,4": 0,
            "2,3": 0,
            "2,4": 0,
        });

        // Test when tile dimensions is 2x the cell dimensions
        traversableCells = await traversableCellsInWorld({
            world,
            tileHeight: asset.tileheight / 2,
            tileWidth: asset.tilewidth / 2,
        });
        expect(Object.keys(traversableCells).length).to.equal(4 * 4);
        expect(traversableCells).toMatchObject({
            "2,6": 0,
            "3,6": 0,
            "2,7": 0,
            "3,7": 0,
            "4,6": 0,
            "5,6": 0,
            "4,7": 0,
            "5,7": 0,
            "2,8": 0,
            "3,8": 0,
            "2,9": 0,
            "3,9": 0,
            "4,8": 0,
            "5,8": 0,
            "4,9": 0,
            "5,9": 0,
        });
    });

    test("Test traversableSpeedInWorld", async () => {
        // No cells with traversableSpeed
        for (const geohash of ["w21z8ucp", "w21z8ucb"]) {
            await expect(
                traversableSpeedInWorld({
                    tileHeight: asset.tileheight,
                    tileWidth: asset.tilewidth,
                    geohash,
                    world,
                }),
            ).resolves.toEqual(undefined);
        }

        // Cells with traversableSpeed
        for (const geohash of [
            "w21z8uck",
            "w21z8ucs",
            "w21z8uc7",
            "w21z8uce",
        ]) {
            await expect(
                traversableSpeedInWorld({
                    tileHeight: asset.tileheight,
                    tileWidth: asset.tilewidth,
                    geohash,
                    world,
                }),
            ).resolves.toEqual(0);
        }

        // Cells with traversableSpeed - tile dimensions smaller than world
        for (const geohash of [
            "w21z8uc9",
            "w21z8ucc",
            "w21z8uc8",
            "w21z8ucb",
            "w21z8udp",
            "w21z8udr",
            "w21z8udn",
            "w21z8udq",
            "w21z8uf1",
            "w21z8uf3",
            "w21z8uf0",
            "w21z8uf2",
            "w21z8u9x",
            "w21z8u9z",
            "w21z8u9w",
            "w21z8u9y",
        ]) {
            await expect(
                traversableSpeedInWorld({
                    tileHeight: asset.tileheight / 2,
                    tileWidth: asset.tilewidth / 2,
                    geohash,
                    world,
                }),
            ).resolves.toEqual(0);
        }
    });

    test("Test World tilelayer", async () => {
        /* Test world colliders/locations
        [
            0, 0, 0, 0,
            0, 0, 0, 0, 
            0, 0, 0, 0, 
            0, x, x, 0, 
            0, x, x, 0,
            0, 0, 0, 0,
            0, 0, 0, 0,
            0, 0, 0, 0,
        ]
        */
        var origin = childrenGeohashes(worldGeohash.slice(0, -1))[0];
        var p = geohashNeighbour(geohashNeighbour(origin, "s", 3), "e");
        var p2 = geohashNeighbour(p, "s");
        expect(world).toMatchObject({
            loc: [origin.slice(0, -1)],
            locT: "geohash",
        });

        /* Test colliders/locations if cell dimensions is different from tile dimensions
        [
            0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, x, x, x, x, 0, 0,
            0, 0, x, x, x, x, 0, 0,
            0, 0, x, x, x, x, 0, 0,
            0, 0, x, x, x, x, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0,
        ]
        */
        var origin = childrenGeohashes(worldTwoGeohash.slice(0, -1))[0];
        var p = geohashNeighbour(geohashNeighbour(origin, "s", 6), "e", 2);
        var p2 = geohashNeighbour(p, "s");
        var p3 = geohashNeighbour(p2, "s");
        var p4 = geohashNeighbour(p3, "s");
        var parentGeohash = origin.slice(0, -1);
        expect(worldTwo.loc).to.deep.equal([
            parentGeohash,
            geohashNeighbour(parentGeohash, "e"),
            geohashNeighbour(parentGeohash, "s"),
            geohashNeighbour(geohashNeighbour(parentGeohash, "s"), "e"),
        ]);

        // Test retrieve worlds
        const { town, worlds } = await crossoverWorldWorlds(
            worldTwoGeohash,
            "geohash",
            {
                Cookie: playerOneCookies,
            },
        );
        expect(town.length).to.equal(worldSeed.spatial.town.precision);
        expect(worlds).toMatchObject([{ world: worldTwo.world }]);

        // Test location origins
        expect(worldThree.loc[0]).toBe("gbsuv7x");
    });

    test("Test World objectlayer", async () => {
        // Test `poisInWorld`
        const pois = await poisInWorld(worldTwo);
        expect(pois).toMatchObject([
            {
                spawn: "player",
                geohash: "y78jdmm5",
            },
            {
                prop: "potionofhealth",
                geohash: "y78jdmm5",
                variables: {},
            },
            {
                prop: "woodenclub",
                geohash: "y78jdmm5",
                variables: {
                    etching: "well used",
                },
            },
            {
                prop: "portal",
                geohash: "y78jdmm5",
                variables: {
                    target: "{{source.item}}",
                    description: "Tavern exit",
                },
            },
            {
                beast: "goblin",
                geohash: "y78jdmm5",
            },
        ]);

        // Test `items` and `monsters` spawned in world
        await spawnWorldPOIs(worldTwo.world, LOCATION_INSTANCE, {
            source: woodenDoor, // use woodenDoor as the source for variable substitution
        });

        // Check entities spawned
        const potionofhealth = await itemRepository
            .search()
            .where("prop")
            .equal("potionofhealth")
            .and("loc")
            .containOneOf("y78jdmm5")
            .and("locI")
            .equal(LOCATION_INSTANCE)
            .and("locT")
            .equal(worldTwo.locT)
            .all();

        const woodenclub = await itemRepository
            .search()
            .where("prop")
            .equal("woodenclub")
            .and("loc")
            .containOneOf("y78jdmm5")
            .and("locI")
            .equal(LOCATION_INSTANCE)
            .and("locT")
            .equal(worldTwo.locT)
            .all();

        const goblin = await monsterRepository
            .search()
            .where("beast")
            .equal("goblin")
            .and("loc")
            .containOneOf("y78jdmm5")
            .and("locI")
            .equal(LOCATION_INSTANCE)
            .and("locT")
            .equal(worldTwo.locT)
            .all();

        const portal = await itemRepository
            .search()
            .where("prop")
            .equal("portal")
            .and("loc")
            .containOneOf("y78jdmm5")
            .and("locI")
            .equal(LOCATION_INSTANCE)
            .and("locT")
            .equal(worldTwo.locT)
            .all();

        expect(woodenclub != null && woodenclub.length === 1).toBe(true);
        expect(potionofhealth != null && potionofhealth.length === 1).toBe(
            true,
        );
        expect(goblin != null && goblin.length === 1).toBe(true);
        expect(portal != null && portal.length === 1).toBe(true);

        // Check portal variable substitution (source during spawing)
        expect((portal[0] as ItemEntity).vars.target).toBe(woodenDoor.item);
    });

    test("Test `spawnWorld` (negative)", async () => {
        // Test cant spawn world on existing world
        await expect(
            spawnWorld({
                assetUrl,
                geohash: worldGeohash, // spawn on existing world
                locationType: "geohash",
                tileHeight: asset.tileheight,
                tileWidth: asset.tilewidth,
            }),
        ).rejects.toThrowError(
            `Cannot spawn world on existing worlds ${world.world}`,
        );
    });
});
