from typing import List, Optional, Dict, Literal, Union
from pydantic import BaseModel, Field


# Prop = str  # Literal["potionofhealth", "woodenclub", "sword"]
# Beast = str  # Literal["goblin", "orc", "pixie"]


class ItemEntity(BaseModel):
    item: str = Field(
        description="ID of the actual item instance (eg. potionofhealth_3)"
    )
    name: str = Field(description="Name of the item (eg. 'A small potion of health')")
    prop: str = Field(description="Type of the item (eg. potionofhealth)")


class MonsterEntity(BaseModel):
    monster: str = Field(description="ID of the actual monster instance (eg. goblin_3)")
    beast: str = Field(description="Type of the item (eg. goblin)")


class PlayerEntity(BaseModel):
    """NPCs are `PlayerEntity`s controlled by the game"""

    name: str = Field(description="Name of the player")
    description: str = Field(description="Description of the player")
    player: str = Field(description="ID of the player instance (eg. player187)")


class QuestItem(BaseModel):
    """Quest item which the player needs to acquire to complete the quest objective"""

    name: str = Field(description="Name of the quest item (eg. 'A family heirloom')")
    prop: Literal["questitem"] = Field(
        description="Quest items prop is always `questitem`"
    )
    obtainedFrom: Union[MonsterEntity, PlayerEntity] = Field(
        description="The NPC or monster from which to obtain this quest item either through dialogue or killing"
    )


class QuestObjective(BaseModel):
    objective: str = Field(description="Unique identifier for the objective")
    description: str = Field(
        description="Detailed description of what needs to be done"
    )
    questItem: QuestItem = Field(description="Completion quest item")


class PropQuantity(BaseModel):
    """
    For the prop use only from this list: ["potionofhealth", "woodenclub", "sword"]
    """

    prop: str = Field(description="Type of the item (eg. potionofhealth)")
    quantity: int = Field(description="Number of items of prop type")


class QuestRewards(BaseModel):
    """
    Rewards for completing the quest

    lumina: Positive number if the quest is a "good" aligned quest, 0 otherwise
    umbra: Positive number if the quest is an "evil" aligned quest, 0 otherwise
    props: Choose from this list only ["potionofhealth", "woodenclub", "sword"]

    For umbra and lumina use the following numbers depending on the difficulty of the quest:
        easy: 20
        medium: 100
        hard: 1000

    For props:
        - For consumables you may give a quantity of 1-5 depending on the difficulty,
        - For items like armour, weapons, the quantity should be 1
    """

    props: List[PropQuantity] = Field(
        description="List of props to be given as rewards"
    )
    lumina: int = Field(description="Amount of lumina (light currency) rewarded")
    umbra: int = Field(description="Amount of umbra (dark currency) rewarded")


class QuestIntroduction(BaseModel):
    """
    Quest name and description.
    """

    name: str = Field(description="Name for the quest")
    description: str = Field(description="Description of the quest's story and goals")


class QuestEntities(BaseModel):
    """
    Quest entities directly involved in the quest
    """

    monsters: List[MonsterEntity] = Field(
        description="The monsters involved in this quest"
    )
    npcs: List[PlayerEntity] = Field(description="The NPCs involved in this quest")
    items: List[ItemEntity] = Field(description="The items involved in this quest")


class QuestTemplate(BaseModel):
    """
    The generated quest template.
    """

    introduction: QuestIntroduction
    entities: QuestEntities
    rewards: QuestRewards
    questItem: QuestItem
