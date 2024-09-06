import pytest
from quest.models import QuestEntities, QuestEntity
from quest.quest import generate_quest


def test_generate_quest():
    quest_inputs = QuestEntities(
        monsters=[
            QuestEntity(
                id="goblin_1", name="Goblin", type="monster", geohash="u4pruydqqvj"
            ),
        ],
        items=[
            QuestEntity(id="sword_1", name="Sword", type="item", geohash="u4pruydqqvj"),
        ],
        players=[
            QuestEntity(
                id="player_1", name="Hero", type="player", geohash="u4pruydqqvj"
            ),
        ],
    )

    quest = generate_quest(quest_inputs)

    assert quest.quest is not None
    assert quest.name is not None
    assert quest.description is not None
    assert len(quest.objectives) > 0
    assert quest.entities is not None
    assert len(quest.dialogues) > 0
    assert quest.rewards is not None
    assert quest.is_completed == False
