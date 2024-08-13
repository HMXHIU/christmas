from typing import Dict, List, Literal, TypedDict
from .abilities import abilities


AbilityType = Literal["offensive", "healing", "defensive", "neutral"]
Alignment = Literal["good", "neutral", "evil"]
StatValue = Literal[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]


class Beast(TypedDict):
    beast: str
    description: str
    attack: StatValue
    defense: StatValue
    health: StatValue
    speed: StatValue
    magic: StatValue
    endurance: StatValue
    rarity: StatValue
    abilities: Dict[AbilityType, List[str]]
    behaviours: List[str]
    alignment: Alignment
    spawnRate: StatValue
    spawnBiomes: List[str]
    spawnHostileThreshold: float


bestiary: Dict[str, Beast] = {
    "goblin": {
        "beast": "goblin",
        "description": "A small, green creature that loves to steal shiny things.",
        "attack": 1,
        "defense": 1,
        "health": 1,
        "speed": 1,
        "magic": 1,
        "endurance": 1,
        "rarity": 1,
        "abilities": {
            "offensive": [abilities["scratch"]["ability"]],
            "healing": [abilities["bandage"]["ability"]],
            "defensive": [],
            "neutral": [],
        },
        "behaviours": [],
        "alignment": "evil",
        "spawnRate": 1,
        "spawnBiomes": [],
        "spawnHostileThreshold": 0.1,
    },
    "giantSpider": {
        "beast": "giantSpider",
        "description": "A huge spider that can paralyze its prey.",
        "attack": 2,
        "defense": 1,
        "health": 1,
        "speed": 2,
        "magic": 2,
        "endurance": 1,
        "rarity": 1,
        "abilities": {
            "offensive": [
                abilities["bite"]["ability"],
                abilities["paralyze"]["ability"],
            ],
            "healing": [],
            "defensive": [],
            "neutral": [],
        },
        "behaviours": [],
        "alignment": "neutral",
        "spawnRate": 1,
        "spawnBiomes": [],
        "spawnHostileThreshold": 0.1,
    },
    "dragon": {
        "beast": "dragon",
        "description": "A huge, fire-breathing lizard.",
        "attack": 10,
        "defense": 10,
        "health": 10,
        "speed": 10,
        "magic": 8,
        "endurance": 8,
        "rarity": 10,
        "abilities": {
            "offensive": [
                abilities["bite"]["ability"],
                abilities["breathFire"]["ability"],
            ],
            "healing": [],
            "defensive": [abilities["blind"]["ability"]],
            "neutral": [],
        },
        "behaviours": [],
        "alignment": "evil",
        "spawnRate": 10,
        "spawnBiomes": [],
        "spawnHostileThreshold": 0.5,
    },
}
