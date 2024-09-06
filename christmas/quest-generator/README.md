# Quest Generator

This project uses LangChain and Ollama to generate quests for a game based on given entities and locations.

## Setup

1. Make sure you have Python 3.9+ installed.
2. Install Poetry: https://python-poetry.org/docs/#installation
3. Install Ollama: https://ollama.ai/
4. Clone this repository
5. Navigate to the project directory
6. Run `poetry install` to install dependencies

## Usage

1. Start the Ollama server (usually runs on http://localhost:11434)
2. Run the following command to generate a quest:

```bash
poetry run python -m quest_generator.main
```

## To generate a quest in your own Python script:

```python
from quest_generator.models import QuestEntities, QuestEntity
from quest_generator.quest_generator import generate_quest

quest_inputs = QuestEntities(
    monsters=[
        QuestEntity(id="goblin_1", name="Goblin", type="monster", geohash="u4pruydqqvj"),
    ],
    items=[
        QuestEntity(id="sword_1", name="Sword", type="item", geohash="u4pruydqqvj"),
    ],
    players=[
        QuestEntity(id="player_1", name="Hero", type="player", geohash="u4pruydqqvj"),
    ]
)

quest = generate_quest(quest_inputs)
print(quest.json(indent=2))
```

## Running Tests

To run tests, use the following command:

```bash
poetry run pytest
```
