from typing import List, Optional, Dict
from pydantic import BaseModel, Field


class QuestEntity(BaseModel):
    id: str = Field(description="Unique identifier for the entity")
    name: str = Field(description="Name of the entity")
    type: str = Field(description="Type of entity (monster, item, or player)")
    geohash: str = Field(description="Geohash location of the entity")


class QuestEntities(BaseModel):
    monsters: List[QuestEntity] = Field(
        description="List of monsters involved in the quest"
    )
    items: List[QuestEntity] = Field(description="List of items involved in the quest")
    players: List[QuestEntity] = Field(
        description="List of players involved in the quest"
    )


class QuestInputs(BaseModel):
    locations: Dict[str, Dict[str, str]] = Field(
        ..., description="Dictionary of location information"
    )
    monsters: List[QuestEntity] = Field(
        ..., description="List of monsters involved in the quest"
    )
    items: List[QuestEntity] = Field(
        ..., description="List of items involved in the quest"
    )
    players: List[QuestEntity] = Field(
        ..., description="List of players involved in the quest"
    )


class CompletionItem(BaseModel):
    item: Optional[str] = Field(
        default=None,
        description="Specific item ID required for completion, if applicable",
    )
    prop: str = Field(description="Property or type of item required")
    quantity: int = Field(description="Number of items required")


class QuestObjective(BaseModel):
    objective: str = Field(description="Unique identifier for the objective")
    description: str = Field(
        description="Detailed description of what needs to be done"
    )
    completion_items: List[CompletionItem] = Field(
        description="Items required to complete this objective"
    )


class RewardItem(BaseModel):
    prop: str = Field(description="Property or type of item given as reward")
    quantity: int = Field(description="Number of items given")


class Rewards(BaseModel):
    items: List[RewardItem] = Field(description="List of items given as rewards")
    lumina: int = Field(description="Amount of lumina (light currency) rewarded")
    umbra: int = Field(description="Amount of umbra (dark currency) rewarded")


class QuestTemplate(BaseModel):
    quest: str = Field(description="Unique identifier for the quest")
    name: str = Field(description="Short, catchy name for the quest")
    description: str = Field(
        description="Detailed description of the quest's story and goals"
    )
    entities: QuestEntities = Field(description="Entities involved in the quest")
    objectives: List[QuestObjective] = Field(
        description="List of objectives that need to be completed"
    )
    rewards: Rewards = Field(description="Rewards given upon quest completion")
    isCompleted: bool = Field(
        default=False, description="Whether the quest has been completed"
    )
