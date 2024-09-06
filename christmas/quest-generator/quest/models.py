from typing import List, Optional
from pydantic import BaseModel


class QuestEntity(BaseModel):
    id: str
    name: str
    type: str
    geohash: str


class Location(BaseModel):
    name: str
    description: str
    nearby_locations: List[str]


class QuestObjective(BaseModel):
    objective: str
    description: str
    completion_items: List[dict]


class QuestTemplate(BaseModel):
    quest: str
    name: str
    description: str
    objectives: List[QuestObjective]
    entities: dict
    dialogues: List[dict]
    rewards: dict
    is_completed: bool = False


class QuestEntities(BaseModel):
    monsters: List[QuestEntity]
    items: List[QuestEntity]
    players: List[QuestEntity]
