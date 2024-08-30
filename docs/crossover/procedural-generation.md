# Procedural Generation of World

- Split map into 32 (8 \* 4) squares, give it general attributes, let procedural generation generate new attributes for lower grid levels
- Start at the higest level `continent`
- `precision` refers to the number of `geohash` characters
- `unit` precision is the smallest unit of movement (approximately 38m \* 18m in real world)

```ts
seeds: {
    spatial: {
        continent: {
            precision: 1,
        },
        territory: {
            precision: 2,
        },
        region: {
            precision: 3,
        },
        city: {
            precision: 4,
        },
        town: {
            precision: 5, // 4.89km * 4.89km
        },
        village: {
            precision: 6,
        },
        house: {
            precision: 7,
        },
        unit: {
            precision: 8, // 38m * 18m
        },
    },
    continent: {
        b: {
            biome: {
                forest: 0.1,
                grassland: 0.7,
                desert: 0.1,
                tundra: 0.1,
            },
            weather: {
                baseTemperature: 25,
                temperatureVariation: 10,
                rainProbability: 0.2,
                stormProbability: 0.05,
            },
        },
        // ...
    },
},
```

## Landmarks & settings at each geohash precision

#### Landmarks

continent:

- 1 citadel (highest ranked city)
- 1 portal located at the citadel (highest ranked city)
- Portal may be used to teleport to other cities

territory:

- 1 major dungeon (pseudo random)

region:

- 1 city

city:

- 0-1 outpost (also act as starting point of the player)

#### Settings

continent:

- `biome` & `weather` parameters

territory:

- `faction` parameters eg. beasts

## Biome

- See `biomeParametersAtCity`, `biomeAtGeohash`
- biome parameters are generated at the `city` level
- using `BiomeParameters`, `biomeAtGeohash` generates the biome tiles at each unit precision procedurally

## Descriptions

- See `biomeParametersAtCity`, `MudDescriptionGenerator.locationDescriptions`
- Location descriptions are at the `city` level

## Dungeons

- Dungeons are underground `locT=d1`, the default biome for for underground is `underground` which is untraversable
- Need some kind of noise function which is fast and reproducible in both javascript and python
- Noise function generates traversable pockets in the underground biome
- Procedurally generate `entrance`s that links the `locT=geohash` (above ground) to `locT=d1` (underground)
- At `entrance` the player can interact with the `item` using `down` & `up`
- A dungeon `entrance` can just be an `item` that has a `teleport` ability that changes `locT` from `geohash` to `d1` and vice versa
- 1 major dungeon at every `territory` level eg. wp, v7, ...

#### Dungeon Locations and Entrances

- [x] Each territory has a major dungeon
- [x] If location is not set manually, it uses the territory as a seed to determine the location
- [x] Create `dungeons` to manually determine the location of a dungeon on a territory

```ts
interface Dungeon {
  dungeon: string;
  rooms: {
    room: string;
    entrances: string[];
  }[];
}

const dungeons: Dungeon[] = [
  {
    dungeon: "w21",
    rooms: [
      {
        room: "w21z9",
        entrances: ["w21z9edk"],
      },
    ],
  },
];
```

- [ ] Create dungeon entrance/exit items which teleport player down or up by changing the locationType
- [x] Create init script to create dungeon entrace/exit items at entrances
- [x] Randomly generated dungeons need to entrances/exit randomly via a seed

#### Pseudo Algorithm

```ts
function dungeonFeatureAtGeohash(
  geohash: string,
  locationType: GeohashLocationType,
  options?: {
    seed?: WorldSeed;
  }
);
```

1. Get the `territory` of geohash (first 2 characters)
2. Use the `teritory` as a `seed` for `dungeonFeatureAtGeohash`
3. Determine the location of the dungeon using the `seed` - the location is `city` precision (3 characters of geohash)
4. Determine the number (with a min/max) and location of the chambers and rooms using the seed, each chamber/room is a `town` (5 characters of geohash)
5. Connect the rooms using the following algorithm
   - Given a list of rooms (eg. rooms = [v77ns, v77n, v77us, v77u4, v77uq, v77un])
   - Start at a random room (using the `seed` to select), this is the `start` room
   - Sort the rooms by closest distance to `start`
   - Determine the rooms connected to this room (`start`), randomly select between 1 or 2 using the `seed`
   - Select the next room of the sorted rooms (do not include the room we came from) and do the same to determine which rooms are connected to it
   - Continue until we reach the last room or if all the rooms have 2 connections
   - This will end with a graph (we can cache this for the dungeon at `territory`)
6. Given the `graph` with each node consisting of a location (5 character) and a set of edges between each node
   - If geohash is at node location (match 5 characters) we return a traversable biome such as `grassland`
   - If the geohash is not at a node, it could be in a corridor (edge) we need to check this using either a line with thickness or a spline for more variation and check if the geohash is within that line/spline

## Code Reference

```ts
type GeohashLocationType =
  | "geohash" // above ground
  | "d1" // underground
  | "d2"
  | "d3"
  | "d4"
  | "d5"
  | "d6"
  | "d7"
  | "d8"
  | "d9";

type BiomeType =
  | "grassland"
  | "forest"
  | "desert"
  | "tundra"
  | "underground" // underground biome (traversableSpeed=0)
  | "aquatic";

async function biomeAtGeohash(
  geohash: string,
  locationType: GeohashLocationType,
  options?: {
    seed?: WorldSeed;
    topologyResultCache?: CacheInterface;
    topologyBufferCache?: CacheInterface;
    topologyResponseCache?: CacheInterface;
    biomeAtGeohashCache?: CacheInterface;
    biomeParametersAtCityCache?: CacheInterface;
  }
): Promise<[BiomeType, number]> {
  // Get from cache
  const cacheKey = `${geohash}-${locationType}`;
  const cachedResult = await options?.biomeAtGeohashCache?.get(cacheKey);
  if (cachedResult) return cachedResult;

  if (!geohashLocationTypes.has(locationType)) {
    throw new Error("Location is not a GeohashLocationType");
  }

  const seed = options?.seed || worldSeed;
  let result: [BiomeType, number] = ["grassland", 1];

  // Underground
  if (locationType !== "geohash") {
    result = [biomes.underground.biome, 1];
  }
  // Leave h9* for ice for testing (fully traversable)
  else if (geohash.startsWith("h9")) {
    result = [biomes.tundra.biome, 0]; // strength=0 no decorations
  } else {
    // Get elevation
    const height = await elevationAtGeohash(geohash, locationType, {
      responseCache: options?.topologyResponseCache,
      resultsCache: options?.topologyResultCache,
      bufferCache: options?.topologyBufferCache,
    });

    // Below sea level
    if (height < 1) {
      result = [biomes.aquatic.biome, 1];
    }
    // Biome parameters are determined at the `city` level similar to descriptions
    else {
      const city = geohash.slice(0, seed.spatial.city.precision);
      const biomeParameters = await biomeParametersAtCity(city, {
        seed,
        biomeParametersAtCityCache: options?.biomeParametersAtCityCache,
      });

      const biomeProbs = biomeTypes.map((biome) => biomeParameters[biome] || 0);
      const totalProb = biomeProbs.reduce((sum, prob) => sum + prob, 0);
      const rv = seededRandom(stringToRandomNumber(geohash)) * totalProb;

      let cumulativeProb = 0;
      for (let i = 0; i < biomeTypes.length; i++) {
        cumulativeProb += biomeProbs[i];
        if (rv < cumulativeProb) {
          const biomeMid = cumulativeProb - biomeProbs[i] / 2;
          const intensity = 1 - Math.abs(rv - biomeMid) / (biomeProbs[i] / 2);
          result = [biomeTypes[i], intensity];
          break;
        }
      }
    }
  }

  if (options?.biomeAtGeohashCache) {
    await options.biomeAtGeohashCache.set(cacheKey, result);
  }

  return result;
}

async function biomeParametersAtCity(
  city: string,
  options?: {
    seed?: WorldSeed;
    biomeParametersAtCityCache?: CacheInterface;
  }
): Promise<BiomeParameters> {
  // Get from cache
  const cachedResult = await options?.biomeParametersAtCityCache?.get(city);
  if (cachedResult) return cachedResult;

  const seed = options?.seed ?? worldSeed;
  const continent = city.charAt(0);
  const biomeParameters = cloneDeep(seed.seeds.continent[continent].biome); // don't change the original seed
  // Add noise/variation at the city level
  for (const [biome, prob] of Object.entries(biomeParameters)) {
    const rv = seededRandom(stringToRandomNumber(city + biome)) - 0.5;
    biomeParameters[biome as BiomeType] = Math.max(0.7 * prob + 0.3 * rv, 0);
  }
  // Re-normalize
  const totalNoise = Object.values(biomeParameters).reduce(
    (sum, value) => sum + value,
    0
  );
  for (const [biome, prob] of Object.entries(biomeParameters)) {
    biomeParameters[biome as BiomeType] = prob / totalNoise;
  }

  // Set cache
  if (options?.biomeParametersAtCityCache) {
    await options?.biomeParametersAtCityCache.set(city, biomeParameters);
  }

  return biomeParameters;
}
```

## Blueprints (Outposts, Towns, etc ...)

- Script will read blueprints and spawns the items specified in the blueprint on location
- Generation is lazy (similar to dungeon)
- Spaning items is done via script (one time) similar to spawning dungeon entrances
- Modify `elevationAtGeohash` to check if there is a `prop`, if there is flatten the elevation
- Procedural generation should take into account of the traversability (biome, water, etc ...)

### Outposts

- Uses `blueprint`
- 0-1 outpost every region (3p) ~8k outposts (32^3 / 2 (water) / 2 (sparse))
- ~ 80k items (if each outpost as about 10 items)
- Outposts can be controlled by factions
- Can be taken over
- Can be supplied with a resource that drives out monsters
- Can be taken over by monsters if not enough resources is provided

#### Pseudo Algorithm

```ts
function bluePrintsAtTerritory(
  territory: string, // 2 precision geohash
  locationType: GeohashLocationType
): TerritoryBlueprint {}

interface TerritoryBlueprint {
  territory: string;
  props: {
    [geohash]: string; // eg. "w21zc5cs": "tavern"
  };
}
```

In a territory there can be different types of blueprint instances of different types, we need to make sure none of them overlap. We are given the frequency information `blueprint.frequency` (how many of the instances should be present at each geohash precision level), the blue print size `blueprint.plotPrecision`.

0. Keep a set of blueprint locations `blueprintLocations`
1. Sort the `blueprints` by descending `plotPrecision`
2. For each `blueprint.frequency` get the `precision` (it should be less than the `territory`)
3. Iterate over all the `blueprint.frequency.precision` over the `territory` (known as a plot)
   - ie. Get all the children geohashes of precision=blueprint.frequency.precision in the territory geohash
4. For each plot, determine the number of instances of the blue print (use the plot as a seed)
5. Choose that number of plots from the children geohashes (use the seed as the rng), do not choose locations in `blueprintLocations`
6. For the chosen plots, procedurally generate the prop locations and save in in `TerritoryBlueprint`
7. Add the plot to the set of blueprint locations
8. Repeat for the next blueprint in the sorted `blueprints`
9. Cache the `TerritoryBlueprint` for each territory

Procedurally generating the prop locations in the plot

1. TODO ...

```ts
type templates = "outpost" | "town";

interface BluePrint {
  template: templates;
  frequency: {
    precision: number; // eg. region (how many instances of the blueprint in the region)
    instances: {
      min: number;
      max: number;
    };
  };
  plotPrecision: number; // eg. town (the actual size of the blueprint)
  clusters: {
    [cluster: string]: {
      props: {
        [prop: string]: {
          instances: {
            min: number;
            max: number;
          };
        };
      };
      position: "random" | "center" | "periphral";
    };
  };
}

const blueprints: Record<templates, BluePrint> = {
  outpost: {
    template: "outpost",
    frequency: {
      precision: worldSeed.spatial.region.precision,
      instances: {
        min: 0,
        max: 1,
      },
    },
    plotPrecision: worldSeed.spatial.town.precision,
    clusters: {
      market: {
        props: {
          tavern: {
            instances: { min: 1, max: 1 },
          },
        },
        position: "random",
      },
    },
  },
  town: {
    template: "town",
    frequency: {
      precision: worldSeed.spatial.region.precision,
      instances: {
        min: 0,
        max: 1,
      },
    },
    plotPrecision: worldSeed.spatial.town.precision,
    clusters: {
      market: {
        props: {
          tavern: {
            instances: { min: 1, max: 1 },
          },
        },
        position: "random",
      },
    },
  },
};
```
