import requests
from langchain.llms.base import LLM
from langchain.callbacks.manager import CallbackManagerForLLMRun
from typing import Any, List, Optional, Dict
from langchain.prompts import PromptTemplate
from langchain.chains import LLMChain
from langchain.output_parsers import PydanticOutputParser
from .models import QuestTemplate, QuestEntity, QuestInputs
from langchain.pydantic_v1 import BaseModel, Field


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
    input_parser = PydanticOutputParser(pydantic_object=QuestInputs)
    output_parser = PydanticOutputParser(pydantic_object=QuestTemplate)

    prompt_template = PromptTemplate(
        template="""
        Generate a quest based on the following information:

        Input Schema:
        {input_schema}

        Provided Data:
        Locations: {locations}
        Monsters: {monsters}
        Items: {items}
        Players: {players}

        The quest should be coherent with the locations provided. Ensure that objectives involve traveling between nearby locations.
        
        Please follow these guidelines when creating the quest:
        1. Create a unique identifier for the quest.
        2. Give the quest a short, catchy name.
        3. Provide a detailed description of the quest's story and goals.
        4. Use the provided entities (monsters, items, players) in the quest. You can also introduce new entities if necessary.
        5. Create one or more objectives for the quest. Each objective should have:
           - A unique identifier
           - A clear description of what needs to be done
           - Any items required for completion (if applicable)
        6. Define appropriate rewards for completing the quest, including items, lumina (light currency), and umbra (dark currency).
        7. Set isCompleted to false, as this is a new quest.

        Output the quest in the following format:
        {format_instructions}

        Ensure that the quest is challenging but achievable, and that the rewards are appropriate for the difficulty of the quest. Use the provided entities and locations to create a coherent and interesting quest narrative.
        """,
        input_variables=["locations", "monsters", "items", "players"],
        partial_variables={
            "input_schema": input_parser.get_format_instructions(),
            "format_instructions": output_parser.get_format_instructions(),
        },
    )

    return LLMChain(llm=llm, prompt=prompt_template, output_parser=output_parser)


def generate_quest_with_llm(chain, enriched_inputs: QuestInputs) -> QuestTemplate:
    response = chain.run(
        locations=enriched_inputs.locations,
        monsters=enriched_inputs.monsters,
        items=enriched_inputs.items,
        players=enriched_inputs.players,
    )
    return response  # This will now return a QuestTemplate object
