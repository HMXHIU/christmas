import type { CacheInterface } from "$lib/caches";
import type {
    EntityStats,
    Monster,
    Player,
    World,
} from "$lib/server/crossover/redis/entities";
import type { Attributes } from "./abilities";
import { monsterStats } from "./bestiary";
import { biomeAtGeohash, biomes } from "./biomes";
import { playerStats } from "./player";
import { MS_PER_TICK } from "./settings";
import type { GeohashLocationType } from "./types";
import { traversableSpeedInWorld } from "./world";

export { entityActualAp, entityStats, isGeohashTraversable, recoverAp };

function recoverAp(
    ap: number,
    maxAp: number,
    apclk: number,
    now: number,
): number {
    return Math.min(maxAp, Math.floor(ap + (now - apclk) / MS_PER_TICK));
}

function entityActualAp(
    entity: Player | Monster,
    opts?: { attributes?: Attributes; now?: number; maxAp?: number },
): number {
    const now = opts?.now ?? Date.now();
    const maxAp = opts?.maxAp ?? entityStats(entity, opts?.attributes).ap;
    return recoverAp(entity.ap, maxAp, entity.apclk, now);
}

function entityStats(
    entity: Player | Monster,
    attributes?: Attributes,
): EntityStats {
    return (entity as Player).player
        ? playerStats({ level: entity.lvl, attributes: attributes })
        : monsterStats({
              level: entity.lvl,
              beast: (entity as Monster).beast,
          });
}

async function isGeohashTraversable(
    geohash: string,
    locationType: GeohashLocationType,
    hasCollidersInGeohash: (
        geohash: string,
        locationType: GeohashLocationType,
    ) => Promise<boolean>,
    getWorldForGeohash: (
        geohash: string,
        locationType: GeohashLocationType,
    ) => Promise<World | undefined>,
    options?: {
        topologyResultCache?: CacheInterface;
        topologyBufferCache?: CacheInterface;
        topologyResponseCache?: CacheInterface;
        worldAssetMetadataCache?: CacheInterface;
        worldTraversableCellsCache?: CacheInterface;
    },
): Promise<boolean> {
    // Early return false if has colliders (items)
    if (await hasCollidersInGeohash(geohash, locationType)) {
        return false;
    }

    // Get biome speed
    const [biome, strength] = await biomeAtGeohash(geohash, locationType, {
        topologyResultCache: options?.topologyResultCache,
        topologyBufferCache: options?.topologyBufferCache,
        topologyResponseCache: options?.topologyResponseCache,
    });
    const biomeSpeed = biomes[biome].traversableSpeed;

    // Get world speed
    let worldSpeed = undefined;
    const world = await getWorldForGeohash(geohash, locationType);
    if (world) {
        worldSpeed = await traversableSpeedInWorld({
            world,
            geohash,
            metadataCache: options?.worldAssetMetadataCache,
            resultsCache: options?.worldTraversableCellsCache,
        });
    }

    // worldSpeed overwrites biomeSpeed if present
    const finalSpeed = worldSpeed ?? biomeSpeed;

    return finalSpeed > 0;
}
