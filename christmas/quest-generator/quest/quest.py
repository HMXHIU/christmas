from .models import (
    QuestEntities,
    QuestTemplate,
    QuestIntroduction,
    QuestItem,
    QuestRewards,
)
from langchain_ollama.llms import OllamaLLM
from langchain.schema.runnable import RunnableLambda, RunnableParallel
from langchain.prompts import PromptTemplate
from langchain.output_parsers import (
    PydanticOutputParser,
    RetryOutputParser,
    OutputFixingParser,
)

# Working models llama3.1:8b, mistral-nemo:12b, gemma2:27b


def generate_quest_name_description(
    quest_entities: QuestEntities,
    model: str = "llama2",
):
    llm = OllamaLLM(model=model)
    output_parser = PydanticOutputParser(pydantic_object=QuestIntroduction)
    prompt = PromptTemplate(
        template="""
        Generate a quest name and description involving the following entities:
        Monsters: {monsters}
        Items: {items}
        NPCs: {npcs}

        You may or may not choose to use all the entities.

        The quest should be interesting a fun.
        The name should be short and catchy.
        The description should be succinct.

        Output the quest in the following format:
        {format_instructions}
        """,
        input_variables=["monsters", "items", "npcs"],
        partial_variables={
            "format_instructions": output_parser.get_format_instructions(),
        },
    )

    retry_parser = RetryOutputParser.from_llm(parser=output_parser, llm=llm)
    completion = prompt | llm
    chain = RunnableParallel(
        completion=completion,
        prompt_value=prompt,
    ) | RunnableLambda(lambda x: retry_parser.parse_with_prompt(**x))

    return chain.invoke(
        {
            "monsters": quest_entities.monsters,
            "items": quest_entities.items,
            "npcs": quest_entities.npcs,
        }
    )


def generate_quest_rewards(
    quest_introduction: QuestIntroduction,
    model: str = "llama2",
):
    llm = OllamaLLM(model=model)
    output_parser = PydanticOutputParser(pydantic_object=QuestRewards)
    prompt = PromptTemplate(
        template="""
        Given the following quest:
        Quest name: {quest_name}
        Quest description: {quest_description}

        I want you to generate the quest rewards.

        Output quest item in the following format:
        {format_instructions}
        """,
        input_variables=["monsters", "items", "npcs"],
        partial_variables={
            "format_instructions": output_parser.get_format_instructions(),
        },
    )

    retry_parser = RetryOutputParser.from_llm(parser=output_parser, llm=llm)
    completion = prompt | llm
    chain = RunnableParallel(
        completion=completion,
        prompt_value=prompt,
    ) | RunnableLambda(lambda x: retry_parser.parse_with_prompt(**x))

    return chain.invoke(
        {
            "quest_name": quest_introduction.name,
            "quest_description": quest_introduction.description,
        }
    )


def generate_quest_item(
    quest_entities: QuestEntities,
    quest_introduction: QuestIntroduction,
    model: str = "llama2",
):
    llm = OllamaLLM(model=model)
    output_parser = PydanticOutputParser(pydantic_object=QuestItem)
    prompt = PromptTemplate(
        template="""
        Given the following quest:
        Quest name: {quest_name}
        Quest description: {quest_description}

        And the following entities involved in the quest:
        Monsters: {monsters}
        Items: {items}
        NPCs: {npcs}

        I want you to generate a quest item which signifies the completion of the quest.
        The player should be able to obtain the item in the quest.
        The quest item should be obtained from one of the NPCs or monsters provided, either through dialogue or killing.

        The quest item is a special item whose prop=questitem
        Give a descriptive name for the item related to the quest

        Output quest item in the following format:
        {format_instructions}
        """,
        input_variables=["monsters", "items", "npcs"],
        partial_variables={
            "format_instructions": output_parser.get_format_instructions(),
        },
    )

    retry_parser = RetryOutputParser.from_llm(parser=output_parser, llm=llm)
    completion = prompt | llm
    chain = RunnableParallel(
        completion=completion,
        prompt_value=prompt,
    ) | RunnableLambda(lambda x: retry_parser.parse_with_prompt(**x))

    return chain.invoke(
        {
            "quest_name": quest_introduction.name,
            "quest_description": quest_introduction.description,
            "monsters": quest_entities.monsters,
            "items": quest_entities.items,
            "npcs": quest_entities.npcs,
        }
    )


def generate_quest_entities(
    quest_entities: QuestEntities,
    quest_introduction: QuestIntroduction,
    model: str = "llama2",
):
    llm = OllamaLLM(model=model)
    output_parser = PydanticOutputParser(pydantic_object=QuestEntities)
    prompt = PromptTemplate(
        template="""
        Given the following quest:
        Quest name: {quest_name}
        Quest description: {quest_description}

        I want you to select the entities involved in the quest from the following:
        Monsters: {monsters}
        Items: {items}
        NPCs: {npcs}

        Do not include any entities not mentioned in the quest

        Output the entities involved in the quest in the following format:
        {format_instructions}
        """,
        input_variables=["monsters", "items", "npcs"],
        partial_variables={
            "format_instructions": output_parser.get_format_instructions(),
        },
    )

    retry_parser = RetryOutputParser.from_llm(parser=output_parser, llm=llm)
    completion = prompt | llm
    chain = RunnableParallel(
        completion=completion,
        prompt_value=prompt,
    ) | RunnableLambda(lambda x: retry_parser.parse_with_prompt(**x))

    return chain.invoke(
        {
            "quest_name": quest_introduction.name,
            "quest_description": quest_introduction.description,
            "monsters": quest_entities.monsters,
            "items": quest_entities.items,
            "npcs": quest_entities.npcs,
        }
    )


def generate_quest(
    quest_entities: QuestEntities,
    model: str = "llama2",
) -> QuestTemplate:

    introduction = generate_quest_name_description(quest_entities, model=model)
    entities = generate_quest_entities(quest_entities, introduction, model=model)
    item = generate_quest_item(entities, introduction, model=model)
    rewards = generate_quest_rewards(introduction, model=model)

    return QuestTemplate(
        introduction=introduction, entities=entities, rewards=rewards, questItem=item
    )
