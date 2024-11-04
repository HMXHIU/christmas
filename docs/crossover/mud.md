# Multi User Dungeon

This RFC describes the behaviour of text for the MUD like feature for the game, text are presented to the user for the following:

1. Location descriptions
2. Combat
3. Chat
4. Errors

**Message Format**

The message format should be an array of strings or a string separated by full stops. It should now overwhelm the user with large text. So the text should be split up and each sentence presented every `tick`. The client should be responsible to break up and present the messages while the server may send the entire chunk

**Message Placement**

Different types of messages should have their own panels for readability:

- Location/Entity descriptions
  - Performing `look`
  - Procedurally generated content
- Player/NPC dialogues & chat messages
- Combat
  - Generated from `Action Event`
  - Calculating difference in entity state
  - Should only include events where `self` is source or `target`

## Server Generated messages

Server generated messages include:

- NPC Dialogues
- Errors
- Entity specific descriptions (non-pg) when `look` at entity is performed

## Client Generated messages

Client messages reduce server and network load as well as making messages more configurable

It includes:

1. Combat Logs

- Use difference in entity (`conditions`, `weight`) to generate logs
- Use `ActionEvent` (include more info in `ActionEvent`: die rolls, damage, damage type, miss, ability, action)
- The `ActionEvent` can also be used for animation
- Create a JSON file to store all combat descriptions (or store in `compendium`, `beasts`)
- Add multiple options and random selection using reproducable hash seed
- Variable substitutable entity names, weapons, nouns, verbs, adjactives
- Tree structure with fallback at the node which meets requirements
- `ActionEvent` should be sent only when the rolls are rolled
- Can't describe everything else it will be flooded - need to be selective what to describe. Animations can fill in.

2. Location Descriptions

Problem:

- When a user enters an location (geohash). A immersive description of the area needs to be generated which is derived from different sources and factors
- It is not possible to manually generate so much descriptions. Need to come up with a system, tool to generate all the information given certain themes

## Sources and factors affecting the description of an area

#### Static Factors

1. The `biome` of the area which is procedurally generated from the `worldSeed` (see `lib/crossover/world/settings/world.ts`)
2. The `continent` (the first character of the geohash location)
   - [x] Each continent has certain properies such as bio, water, hostile, description, etc ... (described in the world seeed)
   - [ ] Typically the continent descriptions are more dealing with geography, topology, fauna,
   - [ ] Generate descriptions for each continent
3. The `region` which the location is closest to which is determined by the closest `santuary` (see `lib/crossover/world/settings/sanctuaries.json`)
   - [ ] Each `sanctuary` has its own description, it represents the capital city in that area
   - [ ] Typically the sanctuary descriptions are more dealing with culture, traditions, history
4. The weather at that location at that time
5. Day night cycle at that location at that time
6. Season at that location at that time

Notes:

- 4,5,6 are considered static because they can be procedurally generated without dynamic information needed from the database

#### Dynamic Factors

These factors are dynamic becase they need to be queried from the database

1. The `Item` entities at that location
2. The `Monster` entities at that location
3. The `Player` entities at that location
4. The `World` description at that location

#### Biome Descriptors

At the continent level, there are 4 major land biome types, sub types can be generated from the 4 major types.
See https://education.nationalgeographic.org/resource/five-major-types-biomes/

Factors affecting subtypes

- Elevation
- Temperature
- Surrounding biomes (there should be a gradual transition from biome to biome not abrubt)

1. grassland
   - savannas
   - tropical
   - temperate
2. forest
   - tropical
   - temperate
   - boreal
3. desert
   - hot & dry
   - cold
4. tundra
   - arctic
   - alpine

```ts
seeds: {
  continent: {
      b: {
          // Change to this format
          biome: {
            grassland: 0.1,
            forest: 0.1,
            desert: 0.1,
            tundra: 0.1,
          },
          factions: {
            goblins: 0.1,
            orcs: 0.2,
          },
          weather: {
              baseTemperature: 25,
              temperatureVariation: 10,
              rainProbability: 0.2,
              stormProbability: 0.05,
          },
      },
  }
}
```

Need to translate the biome paramters to pick a biome tile to show including its decorations

- [ ] The variants could represent the sub types of the biome and the strength/probability
- [ ] The probability should be dynamically alterable, procedurally
- [ ] The decorations & their probability should also be dynamically alterable, procedurally
- [ ] Biome strength should determine the number of decorations
- [x] Noise function for decorations eg. random, perlin

```ts

```

```ts
let biomes: Record<string, Biome> = {
  // Add all subtypes
  forestTropical: {},
  forestTemperate: {},
  forest: {
    biome: "forest",
    name: "Forest",
    traversableSpeed: 0.8,
    asset: {
      path: "biomes/terrain/forest",
      variants: {
        tropical: "tropical", // frames in the sprite sheet
        temperate: "temperate",
        boreal: "boreal",
      },
      prob: {
        tropical: 0.33,
        temperate: 0.33,
        boreal: 0.33,
      },
      width: 1,
      height: 1,
      precision: worldSeed.spatial.unit.precision,
    },
    decorations: {
      grass: {
        // TODO:
        probability: 0.5, // tune based on the strength of the biome
        minInstances: 1, // tune based on the strength of the biome
        maxInstances: 5, // tune based on the strength of the biome
        noise: "perlin", // noise function to use

        radius: 1,
        asset: {
          path: "biomes/grass",
          variants: {
            default: "0053",
            alt1: "0052",
            alt2: "0054",
          },
          prob: {
            default: 0.33,
            alt1: 0.33,
            alt2: 0.33,
          },
          width: 0.5,
          height: 0.5,
          precision: worldSeed.spatial.unit.precision,
        },
      },
    },
  },
};
```

- [ ] `biomeAtGeohash` determines the biome tile to use at a geohash
- [ ] Deprecate the description from biomes
- [ ] Generate descriptor for biome at `city` level using the biome parameters
- [ ] weather and temperature should take into account elevation

## MUD Generator

```ts
// World seed
const worldSeed: WorldSeed = {
  name: "yggdrasil 01",
  description: "The beginning",
  // Geohash precision
  spatial: {
    continent: {
      precision: 1,
    },
    territory: {
      precision: 2,
    },
    guild: {
      precision: 3,
    },
    city: {
      precision: 4,
    },
    town: {
      precision: 5,
    },
    village: {
      precision: 6,
    },
    house: {
      precision: 7,
    },
    unit: {
      precision: 8,
    },
  },
  constants: {
    maxMonstersPerContinent: 10000000000, // 10 billion
  },
  seeds: {
    continent: {
      b: { bio: 0.5, hostile: 0.2, water: 0.1 },
      c: { bio: 0.5, hostile: 0.2, water: 0.1 },
      f: { bio: 0.5, hostile: 0.2, water: 0.1 },
      g: { bio: 0.5, hostile: 0.2, water: 0.1 },
      u: { bio: 0.5, hostile: 0.2, water: 0.1 },
      v: { bio: 0.5, hostile: 0.2, water: 0.1 },
      y: { bio: 0.5, hostile: 0.2, water: 0.1 },
      z: { bio: 0.5, hostile: 0.2, water: 0.1 },
      "8": { bio: 0.5, hostile: 0.2, water: 0.1 },
      "9": { bio: 0.5, hostile: 0.2, water: 0.1 },
      d: { bio: 0.5, hostile: 0.2, water: 0.1 },
      e: { bio: 0.5, hostile: 0.2, water: 0.1 },
      s: { bio: 0.5, hostile: 0.2, water: 0.1 },
      t: { bio: 0.5, hostile: 0.2, water: 0.1 },
      w: { bio: 0.5, hostile: 0.2, water: 0.0 }, // no water for testing
      x: { bio: 0.5, hostile: 0.2, water: 0.1 },
      "2": { bio: 0.5, hostile: 0.2, water: 0.1 },
      "3": { bio: 0.5, hostile: 0.2, water: 0.1 },
      "6": { bio: 0.5, hostile: 0.2, water: 0.1 },
      "7": { bio: 0.5, hostile: 0.2, water: 0.1 },
      k: { bio: 0.5, hostile: 0.2, water: 0.1 },
      m: { bio: 0.5, hostile: 0.2, water: 0.1 },
      q: { bio: 0.5, hostile: 0.2, water: 0.1 },
      r: { bio: 0.5, hostile: 0.2, water: 0.1 },
      "0": { bio: 0.5, hostile: 0.2, water: 0.1 },
      "1": { bio: 0.5, hostile: 0.2, water: 0.1 },
      "4": { bio: 0.5, hostile: 0.2, water: 0.1 },
      "5": { bio: 0.5, hostile: 0.2, water: 0.1 },
      h: { bio: 0.5, hostile: 0.2, water: 0.1 },
      j: { bio: 0.5, hostile: 0.2, water: 0.1 },
      n: { bio: 0.5, hostile: 0.2, water: 0.1 },
      p: { bio: 0.5, hostile: 0.2, water: 0.1 },
    },
  },
};

// Biomes
let biomes: Record<string, Biome> = {
  rocks: {
    biome: "rocks",
    name: "Rocks",
    description: "An untraversable wall of subterranean rocks.",
    traversableSpeed: 0,
    asset: {
      path: "biomes/terrain",
      variants: {
        default: "rocks1",
      },
      prob: {
        default: 1,
      },
      width: 1,
      height: 1,
      precision: worldSeed.spatial.unit.precision,
    },
  },

  forest: {
    biome: "forest",
    name: "Forest",
    description:
      "A dense collection of trees and vegetation, home to a variety of wildlife.",
    traversableSpeed: 0.8,
    asset: {
      path: "biomes/terrain",
      variants: {
        default: "grass1", // frames in the sprite sheet
        alt1: "grass2",
        alt2: "grass3",
      },
      prob: {
        default: 0.33,
        alt1: 0.33,
        alt2: 0.33,
      },
      width: 1,
      height: 1,
      precision: worldSeed.spatial.unit.precision,
    },
    decorations: {
      grass: {
        probability: 0.5, // TODO: to be modified by how strong the perlin noice affects the tile eg. how much "forest" this tile is
        minInstances: 1,
        maxInstances: 5,
        radius: 1,
        asset: {
          path: "biomes/grass",
          variants: {
            default: "0053",
            alt1: "0052",
            alt2: "0054",
          },
          prob: {
            default: 0.33,
            alt1: 0.33,
            alt2: 0.33,
          },
          width: 0.5,
          height: 0.5,
          precision: worldSeed.spatial.unit.precision,
        },
      },
    },
  },
  desert: {
    biome: "desert",
    name: "Desert",
    description:
      "A dry, arid region with extreme temperatures, sparse vegetation, and limited wildlife.",
    traversableSpeed: 1.0,
  },
  tundra: {
    biome: "tundra",
    name: "Tundra",
    description:
      "A cold, treeless area with a frozen subsoil, limited vegetation, and adapted wildlife.",
    traversableSpeed: 1.0,
  },
  grassland: {
    biome: "grassland",
    name: "Grassland",
    description:
      "A region dominated by grasses, with few trees and a diverse range of wildlife.",
    traversableSpeed: 1.0,
  },
  wetland: {
    biome: "wetland",
    name: "Wetland",
    description:
      "An area saturated with water, supporting aquatic plants and a rich biodiversity.",
    traversableSpeed: 0.5,
  },
  mountain: {
    biome: "mountain",
    name: "Mountain",
    description:
      "A high elevation region with steep terrain, diverse ecosystems, and unique wildlife.",
    traversableSpeed: 0,
  },
  hills: {
    biome: "hills",
    name: "Hills",
    description: "A region of elevated terrain, with a variety of wildlife.",
    traversableSpeed: 0.5,
  },
  plains: {
    biome: "plains",
    name: "Plains",
    description: "A large area of flat land, with a variety of wildlife.",
    traversableSpeed: 1.0,
  },
  swamp: {
    biome: "swamp",
    name: "Swamp",
    description:
      "A wetland area with a variety of vegetation, supporting a diverse range of wildlife.",
    traversableSpeed: 0.7,
  },
  water: {
    biome: "water",
    name: "Water",
    description: "A large body of water, with a variety of aquatic life.",
    traversableSpeed: 0,
    asset: {
      path: "biomes/terrain",
      variants: {
        default: "rocks1",
        alt1: "rocks2",
        alt2: "rocks3",
      },
      prob: {
        default: 0.33,
        alt1: 0.33,
        alt2: 0.33,
      },
      width: 1,
      height: 1,
      precision: worldSeed.spatial.unit.precision,
    },
  },

  ice: {
    biome: "ice",
    name: "Ice",
    description:
      "A region covered in ice, with limited vegetation and wildlife.",
    traversableSpeed: 0.8,
    asset: {
      path: "biomes/terrain",
      variants: {
        default: "desert1", // frames in the sprite sheet
        alt1: "desert2",
        alt2: "desert3",
      },
      prob: {
        default: 0.33,
        alt1: 0.33,
        alt2: 0.33,
      },
      width: 1,
      height: 1,
      precision: worldSeed.spatial.unit.precision,
    },
    decorations: {
      grass: {
        probability: 0.5, // TODO: to be modified by how strong the perlin noice affects the tile eg. how much "forest" this tile is
        minInstances: 1,
        maxInstances: 5,
        radius: 1,
        asset: {
          path: "biomes/grass",
          variants: {
            default: "0053",
            alt1: "0052",
            alt2: "0054",
          },
          prob: {
            default: 0.33,
            alt1: 0.33,
            alt2: 0.33,
          },
          width: 0.5,
          height: 0.5,
          precision: worldSeed.spatial.unit.precision,
        },
      },
    },
  },
};

// Sanctuaries
[
  {
    name: "Kabul Refuge",
    description: "A safe haven in the capital city of Afghanistan.",
    region: "AFG",
    geohash: "tt3jwh8x",
  },
  {
    name: "Tirana Refuge",
    description: "A safe haven in the capital city of Albania.",
    region: "ALB",
    geohash: "srq0bj3d",
  },
  {
    name: "Algiers Refuge",
    description: "A safe haven in the capital city of Algeria.",
    region: "DZA",
    geohash: "spfp3jz7",
  },
  {
    name: "Pago Pago Refuge",
    description: "A safe haven in Pago Pago, American Samoa.",
    region: "ASM",
    geohash: "vnk4r9b8",
  },
];
```

## Weather effects on spells

- Dry: +fire, -lightning, -cold
- Wet: -fire, +lightning, +cold
- Hot: +cold
- Cold: +fire
- Day: +night
- Night: +day

#### Tasks

- [x] Deprecate `tileAtGeohash` and replace with `MudDescriptionGenerator.descriptionAtGeohash`
- [x] Deprecate `Tile` with `Descriptor`
- [x] Implement weather, season, day/night cycle descriptors
- [x] Create a function to generate high precison paramters from lower ones using noise (only need to specify at continent level)
- [x] Generate biome location descriptor from `city` level parameters
