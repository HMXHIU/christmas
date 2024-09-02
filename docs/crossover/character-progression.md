# Character Progression

## Currency (LUs)

- Lumina/Umbra (LUs) is also used as the unified currency for leveling & trading.
- 2 main currencies Lumina (light) and Umbra (shadow). Each could be gotten by performing light or dark actions (or killing light/shadow creatures).
- When user dies a portion or fixed amount of LUs is lost.
- LUs can be used to enter leveling quests (failure results in half of currency being refunded).
- Currency cannot be stored in banks, but part of the player's account.
- Fear of losing LUs should cause the player to prepare and strategize before entering a dungeon.
- Magic which should be powerful but rare also costs LUs.

## Levels

- There is no player level, only skill lines and guild levels
- Guild levels are restricted alignment (good, evil, lawful, chaos), gender (male, female), race (human, etc...)
- Skill lines are less restricted (attributes)
- Levels should not significantly increase the power of a player, but rather ensure that a player has the skills required to solo a dungeon.
- Levels are attained when a player spends currency to enter a leveling quest and completes it.
- Some guild levels may require a more experienced player or a guild master to give approval (or an AI)
- Leveling quests are solo quests require a key (purchased with LUs) to enter.
- LUs cost of leveling quests increases exponentially with each level.
- Skills, items, preparation, tactics and teamwork should be more important than levels.
- Current cap for level is set at 5

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
- Players should have optimal gear, LUs and skills.

**Level 5**

- Difficulty: 1% of players should be able to reach this level

**Questions**

1. Should LUs be stored in NFT or PlayerMetadata (MINIO)?
   **Answer**: Store in PlayerMetadata (MINIO), only when player levels up, the level is store in NFT account

#### Solo dungeons

- [ ] Create a key item which transports the user into a solo dungeon
  - [ ] Key has 1 use
  - [ ] When used, teleports user into a `GeohashLocationType`
- [ ] Create solo dungeon instances
  - [ ] A plot of specified geohash dimensions
  - [ ] A world template to spawn
  - [ ] Monster spawn points, server should spawn monsters
  - [ ] An entrance, exit
  - [ ] Quest to complete
