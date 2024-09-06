from .models import QuestEntities, QuestEntity
from .quest import generate_quest


def main():
    # Example usage
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
    print(quest.json(indent=2))


if __name__ == "__main__":
    main()
