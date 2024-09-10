# NPCs

NPCs are `PlayerEntities` controlled by the game (dungeon master). Eventually they should also be able to act autonomously with players. Thus they should have Solana Accounts of their own, similar to actual player accounts.

## What NPCs are able to do

- Players can `learn` skills from them via the `learn` action (non-llm)
- Players can `trade/buy/sell` with them via the `trade/buy/sell` action (non-llm)
- Act as merchants
- Drive the story line
- Give out quests to players
- Be involved as quest entities

## Dialogues with NPCs

- Triggered when the player speaks to an NPC (`say` action)

#### Respond using LLMs

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

#### Respond using Dialogues

Might not always have enough processing power to use LLM. In such cases respond with `A light fades from his/her eyes as she/he ignores you.`

When not using LLMs the NPC switches back to its `default` behaviour for instance if he was a blacksmith, he should continue his blacksmith dialogues.

- General dialogues should not be tied to an NPC but instead use templates so they can be reused across multiple similar NPCs
- Dialogues should be stored in redis so they can be searched quickly on different fields such as `factions`, `alignment`, `race`, `archetype`
- Specific dialogues such as `grt` (greet), `ign` (ignore),
- Allow AND, OR conditions using redis search syntax (raw query string)
- Allow variable substitution into the redis search query string

  ```ts
  const dialogues = {
    innKeeper: {
      grt: [
        {
          cond: "${player.race}"
          msg: "${name} greets you, 'Well met kin, you may *rest* here ${timeOfDay}' ",
        },
      ],
      ign: [
        {
          msg: "${name} ignores you, 'Get lost, we don't deal with your types around here!'.",
        },
      ],
    },
  };
  ```

Default NPCs dialogue behaviours Pseudocode

TODO: Design an NPC default dialogue system

- Greet: Introduce NPC, NPC should tell player what he can ask (merchant: buy/sell, teacher: learn, historian: ask about topics, in this case NPC should provide a list of things to ask about)

```ts
merchantDialogue = {
  greet:
    "Hello there, traveler! ${name} at your service! Would you be interested in some most delicious food? Feel free to *browse ${name}*",
  topics: {
    food: "You need food to *rest*. After every rest ....",
  },
};
```

```python
class NPC:

    def __init__(self, name):
        self.name = name
        self.dialogue = {
            'greet': "Hello there, traveler!",
            'quest': "I need help gathering herbs from the forest.",
            'goodbye': "Farewell, and safe travels."
        }
        self.state = {
            'quest_completed': False
        }

    def handle_dialogue(player_input, npc):
        # Assume the player input is something like "ask NPC about quest"
        keyword = extract_keyword(player_input)

        if keyword in npc.dialogue:
            return npc.dialogue[keyword]
        else:
            return "The NPC doesn't understand what you're asking."

def complete_quest(player, npc):
    npc.state['quest_completed'] = True
    npc.dialogue['quest'] = "Thank you for gathering the herbs!"

def get_npc_dialogue(npc, player):
    if player.has_item('herb') and not npc.state['quest_completed']:
        return "Thank you for bringing the herb! Here is your reward."
    elif npc.state['quest_completed']:
        return "You’ve already completed my quest. Thank you!"
    else:
        return npc.dialogue['quest']
```

```json
{
  "npc_name": "Old Herbalist",
  "dialogue": {
    "greet": "Hello, traveler.",
    "quest": "I need help gathering herbs from the forest.",
    "goodbye": "Farewell, and safe travels."
  },
  "state": {
    "quest_completed": false
  }
}
```

## Creating NPCs

- Use `Keypair.generate()` with the dungeon master private key to generate the NPC
- There can only be one public key for a private key - How do we manage multiple NPCs with one dungeon master private key?
  1. Store generate new keys for each npc and store the private key in MINIO **[Use this method]**
     - This way it is identical to an actual user, if in the future it needs to be autonomous
     - It can sign its own transactions via an agent with the private key
  2. Don't use the public key as player id, instead use `npc_${npc}_{instance}`
     - We need to create a new system around npcs
- Use an `npc` field to differentiate players from npcs in `PlayerEntity` (redis) & `PlayerMetadata` (MINIO)

#### NPC Templates and Procedural Generation

**Motivation:** Some NPCs are unique with only 1 instance, others like general merchants are duplicated. Even for unique NPCs there might be the case where they need to exist in different world instances (eg. tutorials).

- Use `npc=${templateId}_${instance}` to specify that a `PlayerEntity` is a npc while
- NPC templates should be stored in server side only as they include game senstive information about the NPC
- `prop` is to `item` what `npc` is to `player`

```ts
const npcs = {
  innKeeper: {
    npc: "innKeeper",
    name: "",
    description: "",
  },
};
```

## Tasks & TODOs

- [ ] Create npc template
- [ ] Create endpoint to spawn npc
- [ ] Implement `learn` action with NPCs
- [ ] Come up with a general prompt that takes the information above and form a reply or perform an action
- [ ] Implement `browse` action with NPCs (returns a list of items)
- [ ] Implement `trade` action with NPCs (when transacting a specific item)
- [ ] Store historical conversations with player (Eventually might be an autonomous agent on ICP)
- [ ] Implement `follow` action for NPCs to follow player (keep a certain range from player)
- [ ] Vectorize world library to make it searchable (MINIO for long term storage, Redis for vector search)
- [ ] Implement agent to search world library for relevant information
- [ ] Implement NPC knowledge system
