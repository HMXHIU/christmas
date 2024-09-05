# Character Progression

## Currency (LUs)

- Lumina/Umbra (`LUs`) is also used as the unified currency for leveling & trading.
- 2 main currencies Lumina (light) and Umbra (shadow). Each could be gotten by performing light or dark actions (or killing light/shadow creatures).
- When user dies a portion or fixed amount of `LUs` is lost.
- `LUs` can be used to purchase `dungeon keys` to enter leveling quests (instanced dungeons).
- Currency cannot be stored in banks, but part of the player's account.
- Fear of losing `LUs` should cause the player to prepare and strategize before entering a dungeon.
- Certain magic which should be powerful but rare can also costs `LUs`.

## Levels

- There are 3 kinds of levels

  1. Player level (increase level and stats (hp, mp, st, etc ..) via `playerStats`)
  2. Skill level (grants new abilities)
  3. Guild level (grants new abilities)

- Player levels increase attributes but not significantly as the skill of the player should matter more
- Guild levels are restricted alignment (good, evil, lawful, chaos), gender (male, female), race (human, etc...)
- Skill lines are less restricted (attributes)

**Level 1**

- New players start at level 1.

**Level 2**

- Difficulty: All players should be able to reach this level
- Players should prove that they can solo a dungeon with common enemies (no boss).
- Players should prove that they know the basic combat and game mechanics.

**Level 3**

- Difficulty: 70% of players should be able to reach this level
- Players should prove that they can solo a dungeon with a boss.

**Level 4**

- Difficulty: 20% of players should be able to reach this level
- Players should have optimal gear, `LUs` and skills.

**Level 5**

- Difficulty: 1% of players should be able to reach this level

## Leveling Quests/Dungeons

- Leveling quests are solo quests require a `dungeon key` (purchased with `LUs`) to enter.
- Player levels are obtained when a player purchases a `dungeon key`
- Guild/Skill levels are obtained when a player completes a dungeon/quest from the `dungeon key`
- Some guild levels may require a more experienced player or a guild master to give approval (or an AI)
- `LUs` cost of leveling quests increases exponentially with each level.
- Skills, items, preparation, tactics and teamwork should be more important than levels.
- Current cap for level is set at 5

#### Tasks

- [ ] Create a `dungeon key` item which transports the player into a solo dungeon
  - [ ] Player can `enter` the `dungeon key`
  - [ ] Key has 1 use/charge/durability
  - [ ] When used, teleports user into an instanced world using the player id
- [ ] Create solo dungeon tilemaps
  - [ ] POIs for spawning monsters/items/player
  - [ ] Quest to complete

## Levels Datastructure

Player long term data is stored in MINIO in:

- `PlayerMetadataSchema` (`user` bucket)
- `PlayerState` (`player` bucket)
  - This is also copied over to redis on login

Loading `PlayerEntity` involves:

- `loadPlayerEntity` reads `PlayerMetadataSchema` and `PlayerState` and sets `PlayerEntity` in redis
- `playerStats` uses both `PlayerMetadataSchema.attributes` and `PlayerState.lvl` to determine the stats (hp, mp, etc...)

Increasing levels:

- Update `PlayerState.lvl` & update `PlayerEntity`
- Update `PlayerState.skills` & update `PlayerEntity`

#### Tasks

- [ ] Add skills to `PlayerState` and `PlayerEntity`
- [ ] Add skill requirements to abilities
- [ ] Add endpoint to level up skills and level

```ts
type Skills = "fighter" | "mage" | "explorer"; // skill lines and guilds

const SkillSchema = z.record(
  z.enum(["fighter", "mage", "explorer"]),
  z.number()
);

const PlayerStateSchema = z.object({
  avatar: z.string().optional(),
  lgn: z.boolean().optional(),
  lum: z.number().optional(),
  umb: z.number().optional(),
  loc: z.array(z.string()).optional(),
  locT: GeohashLocationSchema.optional(),
  hp: z.number().optional(),
  mp: z.number().optional(),
  st: z.number().optional(),
  ap: z.number().optional(),
  lvl: z.number().optional(),
  skill: SkillSchema, // skill/guild levels
  buf: z.array(z.string()).optional(),
  dbuf: z.array(z.string()).optional(),
});
```

```ts
const PlayerAppearanceSchema = z.object({
  hair: z.object({
    type: z.enum(HAIR_TYPES),
    color: z.enum(HAIR_COLORS),
  }),
  eye: z.object({
    type: z.enum(EYE_TYPES),
    color: z.enum(EYE_COLORS),
  }),
  face: z.enum(FACE_TYPES),
  body: z.enum(BODY_TYPES),
  skin: z.enum(SKIN_TYPES),
  personality: z.enum(PERSONALITY_TYPES),
  age: z.enum(AGE_TYPES),
});

const PlayerDemographicSchema = z.object({
  gender: z.enum(GENDER_TYPES),
  race: z.enum(RACE_TYPES),
  archetype: z.enum(ARCHETYPE_TYPES),
});

const PlayerAttributesSchema = z.object({
  str: z.number(),
  dex: z.number(),
  con: z.number(),
  int: z.number(),
  fth: z.number(),
});

const PlayerMetadataSchema = z.object({
  player: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().max(400).optional(),
  avatar: z.string().url(),
  attributes: PlayerAttributesSchema,
  demographic: PlayerDemographicSchema,
  appearance: PlayerAppearanceSchema,
});

const PlayerStateSchema = z.object({
  avatar: z.string().optional(),
  lgn: z.boolean().optional(),
  lum: z.number().optional(),
  umb: z.number().optional(),
  loc: z.array(z.string()).optional(),
  locT: GeohashLocationSchema.optional(),
  hp: z.number().optional(),
  mp: z.number().optional(),
  st: z.number().optional(),
  ap: z.number().optional(),
  lvl: z.number().optional(),
  buf: z.array(z.string()).optional(),
  dbuf: z.array(z.string()).optional(),
});
```

**Questions**

1. Should `LUs` be stored in NFT or PlayerMetadata (MINIO)?
   **Answer**: Store in PlayerMetadata (MINIO), only when player levels up, the level is store in NFT account

1. Where should `levels` be stored?
   **Answer**: Store in PlayerMetadata (MINIO), only when player levels up, the level is store in NFT account
