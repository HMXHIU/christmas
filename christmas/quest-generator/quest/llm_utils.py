import requests
from langchain.llms.base import LLM
from langchain.callbacks.manager import CallbackManagerForLLMRun
from typing import Any, List, Optional
from langchain.prompts import PromptTemplate
from langchain.chains import LLMChain


class OllamaLLM(LLM):
    model: str = "llama2"
    base_url: str = "http://localhost:11434"

    def _call(
        self,
        prompt: str,
        stop: Optional[List[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> str:
        response = requests.post(
            f"{self.base_url}/api/generate",
            json={"model": self.model, "prompt": prompt, "stream": False},
        )
        response.raise_for_status()
        return response.json()["response"]

    @property
    def _llm_type(self) -> str:
        return "ollama"


def create_llm_chain():
    llm = OllamaLLM()
    prompt_template = PromptTemplate(
        input_variables=["locations", "monsters", "items", "players"],
        template="""
        Generate a quest based on the following information:
        Locations: {locations}
        Monsters: {monsters}
        Items: {items}
        Players: {players}

        The quest should be coherent with the locations provided. Ensure that objectives involve traveling between nearby locations.
        
        Output the quest in the following JSON format:
        {{
            "quest": "quest_id",
            "name": "Quest Name",
            "description": "Quest Description",
            "objectives": [
                {{
                    "objective": "objective_id",
                    "description": "Objective Description",
                    "completion_items": [
                        {{"item": "item_id", "prop": "item_prop", "quantity": 1}}
                    ]
                }}
            ],
            "entities": {{
                "monsters": [{{"monster": "monster_id"}}],
                "items": [{{"item": "item_id"}}],
                "players": [{{"player": "player_id"}}]
            }},
            "dialogues": [
                {{
                    "entityId": "entity_id",
                    "text": "Dialogue text",
                    "triggerOnObjective": "objective_id"
                }}
            ],
            "rewards": {{
                "items": [{{"prop": "item_prop", "quantity": 1}}],
                "lumina": 100,
                "umbra": 0
            }},
            "isCompleted": false
        }}
        """,
    )
    return LLMChain(llm=llm, prompt=prompt_template)


def generate_quest_with_llm(chain, enriched_inputs):
    response = chain.run(
        locations=str(enriched_inputs["locations"]),
        monsters=str(enriched_inputs["monsters"]),
        items=str(enriched_inputs["items"]),
        players=str(enriched_inputs["players"]),
    )
    return response
