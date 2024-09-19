# NPCs

NPCs are `PlayerEntities` controlled by the game (dungeon master). Eventually they should also be able to act autonomously with players. Thus they should have Solana Accounts of their own, similar to actual player accounts.

## What NPCs are able to do

- Players can `learn` skills from them via the `learn` action (non-llm)
- Players can `trade/buy/sell` with them via the `trade/buy/sell` action (non-llm)
- Act as merchants
- Drive the story line
- Give out quests to players
- Be involved as quest entities

## Interacting with NPCs

NPC interactions can be triggered in the following cases:

**_Deterministic actions_**

- Player `greet` NPC (eg. "greet blacksmith")
- Player `trade` with NPC (eg. "trade 100lum for potionofhealth with blacksmith")
- Player `give` item to NPC (eg. "give item_questitem_1 to innkeeper")

In these cases, the NPCs can be programed to respond deterministically using a `npcRespondToAction` hook.

Qn: Where should the hook be?

M1: Intercept at the messaging events level (eg. `CTAEvent`, `FeedEvent`)

- This treats each NPC as if an actual human player and easier to migrate in the future
- Some of these actions result in `cta` events which require the NPC to accept

**_Indeterministic actions_**

- Player actions such as `say` (eg. "say blacksmith what is the season now?")

#### Respond To Deterministic Using Dialogues

See:

- `server/crossover/npc.ts` (NPC Logic)
- `server/crossover/settings/npc.ts` (Dialogues and NPCs)

**_Features_**

- General dialogues should not be tied to a specific NPC
- Use variable substitutable templates so they can be reused across multiple similar NPCs
- Dialogues should be stored in redis so they can be searched quickly on different fields such as `factions`, `alignment`, `race`, `archetype`, `npc`
- Specific dialogues such as `grt` (greet), `ign` (ignore),
- Support MUST, OR, EXCLUDE conditions
- Different dialogue types such as `greetings`, `ignoring`, `agro`, `topics`

  ```ts
  type Dialogues = "grt" | "ign" | "agro";

  interface Dialogue {
    msg: string; // message template (variable substituted before indexing)
    dia: Dialogues; // dialogue type
    tgt: string; // target to send the message to (empty = all)
    // Tags (variable substituted before indexing)
    mst?: string[]; // must contain all of these tags
    or?: string[]; // must match any these tags
    exc?: string[]; // must not contain these tags
  }

  const greetings: Dialogue[] = [
    // general
    {
      dia: "grt",
      msg: "${self.name} greets you, 'Well met ${player.name}.'.",
      tgt: "${player.player}",
    },
    // innkeep
    {
      dia: "grt",
      mst: ["npc=innkeep"],
      msg: "${self.name} greets you, 'Well met ${player.name}, you may *rest* here'.",
      tgt: "${player.player}",
    },
  ];
  ```

#### Respond To Indeterministic Actions Using LLMs

Might not always have enough processing power to use LLM. In such cases

- The NPC might respond with `A light fades from his/her eyes as she/he ignores you.`
- The NPC might respond with a predefined sorry message `The blacksmith is not interested in small talk and beckons you to *browse* his goods`
- The NPC might switch back to its default `greet` dialogue

Include the following in the prompt

- NPC name and description
- NPC demographics (archetype, race, gender)
- NPC factions, alignment
- NPC equipment & inventory
- NPC skills, abilities, actions
- Any quests involving the NPC
- Functions/tools that the NPC can perform (perform actions and abilities)
- Historical conversations with player

Include NPC knowledge

- NPCs should have limited knowledge of the world and only answer within its knowledge
- Search only within the NPCs knowledge

Include world information related to the question in prompt

- Requires an agent to call a tool to search for world information (library) to retrieve the relevant information
- Need to vectorize the world library to make it searchable

## Creating NPCs

- Use `Keypair.generate()` to generate a unique keypair for the NPC
- Store generate new keys for each npc and store the private key in MINIO
  - This way it is identical to an actual user, if in the future it needs to be autonomous
  - It can sign its own transactions via an agent with the private key
- Use an `npc` field to differentiate players from npcs in `PlayerEntity` (redis) & `PlayerMetadata` (MINIO)

#### NPC Templates and Procedural Generation

**Motivation:** Some NPCs are unique with only 1 instance, others like general merchants are duplicated. Even for unique NPCs there might be the case where they need to exist in different world instances (eg. tutorials).

- Use `npc=${templateId}_${instance}` to specify that a `PlayerEntity` is a npc while
- NPC templates should be stored in server side only as they include game senstive information about the NPC
- `prop` is to `item` what `npc` is to `player`

```ts
const npcs = {
  innkeep: {
    npc: "innkeep",
    nameTemplate: "Inn Keeper",
    descriptionTemplate:
      "The innkeeper tends to the inn with efficiency, offering food, drink, and a place to rest for travelers. Always attentive to guests, they know much about the town and its visitors",
    asset: {
      path: "",
    },
  },
};
```

## Tasks & TODOs

- [x] Create npc template
- [x] Create endpoint to spawn npc
- [ ] Create hook endpoint to respond to player actions at message level
  - Hook into `publishFeedEvent` and `publishCTAEvent`
- [ ] Implement `learn` action with NPCs
- [ ] Come up with a general prompt that takes the information above and form a reply or perform an action
- [ ] Implement `browse` action with NPCs (returns a list of items)
- [ ] Implement `trade` action with NPCs (when transacting a specific item)
- [ ] Store historical conversations with player (Eventually might be an autonomous agent on ICP)
- [ ] Implement `follow` action for NPCs to follow player (keep a certain range from player)
- [ ] Vectorize world library to make it searchable (MINIO for long term storage, Redis for vector search)
- [ ] Implement agent to search world library for relevant information
- [ ] Implement NPC knowledge system
