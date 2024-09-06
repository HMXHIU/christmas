from typing import Dict
from pydantic import BaseModel
from .models import QuestEntities, QuestTemplate, QuestEntity
from .location_utils import get_location_info
from .llm_utils import create_llm_chain, generate_quest_with_llm


class EnrichedQuestEntities(BaseModel):
    monsters: list[QuestEntity]
    items: list[QuestEntity]
    players: list[QuestEntity]
    locations: Dict[str, Dict[str, str]]


def enrich_quest_entities(entities: QuestEntities) -> EnrichedQuestEntities:
    locations = {}
    for entity_type in ["monsters", "items", "players"]:
        for entity in getattr(entities, entity_type):
            location = get_location_info(entity.geohash)
            locations[location["name"]] = location

    return EnrichedQuestEntities(
        monsters=entities.monsters,
        items=entities.items,
        players=entities.players,
        locations=locations,
    )


def generate_quest(quest_inputs: QuestEntities) -> QuestTemplate:
    enriched_inputs = enrich_quest_entities(quest_inputs)
    llm_chain = create_llm_chain()
    quest = generate_quest_with_llm(llm_chain, enriched_inputs)
    return quest
