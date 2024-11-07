import { GAME_TILEMAPS } from "$lib/crossover/defs";
import { entityInRange, minifiedEntity } from "$lib/crossover/utils";
import { TILE_HEIGHT, TILE_WIDTH } from "$lib/crossover/world/settings";
import { actions } from "$lib/crossover/world/settings/actions";
import { compendium } from "$lib/crossover/world/settings/compendium";
import {
    geohashLocationTypes,
    type GeohashLocation,
} from "$lib/crossover/world/types";
import {
    type ItemEntity,
    type PlayerEntity,
} from "$lib/server/crossover/types";
import { substituteVariablesRecursively } from "$lib/utils";
import { setEntityBusy } from "..";
import { worldAssetMetadataCache, worldPOIsCache } from "../caches";
import { spawnWorld, spawnWorldPOIs } from "../dm";
import { publishAffectedEntitiesToPlayers, publishFeedEvent } from "../events";
import { getNearbyPlayerIds } from "../redis/queries";
import { saveEntity } from "../redis/utils";

export { enterItem };

async function enterItem(player: PlayerEntity, item: ItemEntity, now?: number) {
    // Check can enter item
    const [ok, error] = canEnterItem(player, item);
    if (!ok) {
        await publishFeedEvent(player.player, {
            type: "error",
            message: error,
        });
        return; // do not proceed
    }

    // Set busy
    await setEntityBusy({
        entity: player,
        action: actions.enter.action,
        now: now,
    });

    const prop = compendium[item.prop];

    // Substitute world variables
    const { locationInstance, geohash, world, uri, locationType } =
        substituteVariablesRecursively(prop.world as any, {
            ...item.vars,
            self: item,
        });

    const url = uri.startsWith("http") ? uri : `${GAME_TILEMAPS}/${uri}`;

    // Spawn world (only if not exists)
    await spawnWorld({
        world, // specify the worldId manually, if the world already exists it will fetch it without spawning
        geohash,
        locationType: locationType as GeohashLocation,
        locationInstance,
        assetUrl: url,
        tileHeight: TILE_HEIGHT, // do not change this
        tileWidth: TILE_WIDTH,
    });

    // Spawn world POIs
    const { pois } = await spawnWorldPOIs(world, {
        worldAssetMetadataCache: worldAssetMetadataCache,
        worldPOIsCache: worldPOIsCache,
        source: item,
    });

    // Check for player spawn point (use world geohash as fall back)
    const playerSpawnPOI = pois.find(
        (p) => "spawn" in p && p.spawn === "player",
    );

    const playerLocation = playerSpawnPOI
        ? [playerSpawnPOI.geohash]
        : [geohash];

    const nearbyPlayerIds = await getNearbyPlayerIds(
        player.loc[0],
        player.locT as GeohashLocation,
        player.locI,
    );

    // Change player location to world
    player.loc = playerLocation;
    player.locT = locationType as GeohashLocation;
    player.locI = locationInstance;

    // Save player
    await saveEntity(player);

    // Inform all players of self location change
    await publishAffectedEntitiesToPlayers(
        [minifiedEntity(player, { stats: true })],
        { publishTo: nearbyPlayerIds },
    );
}

function canEnterItem(
    player: PlayerEntity,
    item: ItemEntity,
): [boolean, string] {
    // Check in range
    if (!entityInRange(player, item, actions.enter.range)[0]) {
        return [false, `${item.item} is not in range`];
    }

    // Check if can item can be entered
    const prop = compendium[item.prop];
    if (!prop.world) {
        return [false, `${item.name} is not something you can enter`];
    }

    // Item not in geohash location type
    if (!geohashLocationTypes.has(item.locT)) {
        return [false, `${item.item} is not in this world`];
    }

    return [true, ""];
}
