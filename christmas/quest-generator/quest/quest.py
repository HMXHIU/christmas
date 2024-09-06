import json
from typing import Dict
from .models import QuestEntities, QuestTemplate
from .location_utils import get_location_info
from .llm_utils import create_llm_chain, generate_quest_with_llm


def enrich_quest_entities(entities: QuestEntities) -> Dict:
    locations = {}
    for entity_type in ["monsters", "items", "players"]:
        for entity in getattr(entities, entity_type):
            location = get_location_info(entity.geohash)
            locations[location["name"]] = location

    return {
        "monsters": entities.monsters,
        "items": entities.items,
        "players": entities.players,
        "locations": locations,
    }


def generate_quest(quest_inputs: QuestEntities) -> QuestTemplate:
    enriched_inputs = enrich_quest_entities(quest_inputs)
    llm_chain = create_llm_chain()
    quest_json = generate_quest_with_llm(llm_chain, enriched_inputs)
    quest_dict = json.loads(quest_json)
    return QuestTemplate(**quest_dict)
