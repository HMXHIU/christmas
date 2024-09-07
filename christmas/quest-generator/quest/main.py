from .models import QuestEntities, MonsterEntity, ItemEntity, PlayerEntity
from .quest import generate_quest


def main():
    # Example usage
    quest_entities = QuestEntities(
        monsters=[
            MonsterEntity(monster="goblin_1", beast="goblin"),
        ],
        items=[
            ItemEntity(item="sword_1", prop="sword", name="Rusty iron sword"),
        ],
        npcs=[
            PlayerEntity(
                player="player_1",
                name="George",
                description="George the tavern keeper.",
            ),
        ],
    )

    # Working models llama3.1:8b, mistral-nemo:12b, gemma2:27b
    quest = generate_quest(quest_entities, model="mistral-nemo:12b")
    print(quest.model_dump_json(indent=2))


if __name__ == "__main__":
    main()
