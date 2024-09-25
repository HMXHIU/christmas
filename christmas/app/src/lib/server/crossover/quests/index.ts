import type {
    ItemEntity,
    MonsterEntity,
    PlayerEntity,
} from "$lib/crossover/types";
import { getEntityId } from "$lib/crossover/utils";
import { LOCATION_INSTANCE } from "$lib/crossover/world/settings";
import { compendium } from "$lib/crossover/world/settings/compendium";
import {
    generateRandomSeed,
    sampleFrom,
    substituteVariables,
    substituteVariablesRecursively,
} from "$lib/utils";
import { look } from "../actions";
import { spawnItemInInventory, spawnQuestItem } from "../dungeonMaster";
import { publishFeedEvent } from "../events";
import { itemRepository, questRepository } from "../redis";
import { playerQuestsInvolvingEntities } from "../redis/queries";
import { fetchEntity, saveEntity } from "../redis/utils";
import { npcs } from "../settings/npc";
import { random } from "../utils";
import type {
    DropEffect,
    Objective,
    QuestEntity,
    QuestTemplate,
    Reward,
    Trigger,
} from "./types";

export {
    createQuest,
    createQuestWrit,
    resolveDropEffect,
    resolvePlayerQuests,
    resolveQuestObjective,
    resolveQuestReward,
};

async function createQuest(template: QuestTemplate): Promise<QuestEntity> {
    const entities: Record<string, string> = {};
    const questId = `quest_${template.template}-${await questRepository.search().count()}`;

    // TODO: generate the following using PG or LLM
    const beasts = ["goblin", "giantSpider"];
    const reward = {
        lum: 10,
        umb: 10,
    };
    const npcKeys = Object.keys(npcs);

    // Determine entities
    for (const [templateString, templateEntity] of Object.entries(
        template.entities,
    )) {
        // Determine Beast
        if (templateEntity.type === "beast") {
            entities[templateString] = sampleFrom(
                beasts,
                1,
                generateRandomSeed(random()), // use random() for reproducibility in test environment
            )[0];
        }
        // Determine NPC
        else if (templateEntity.type === "npc") {
            entities[templateString] = sampleFrom(
                npcKeys,
                1,
                generateRandomSeed(random()),
            )[0];
        }
        // Determine Item
        else if (templateEntity.type === "item") {
            // Quest items are spawned at loc=[quest] locT="quest"
            const questItem = await spawnQuestItem({
                quest: questId,
                prop: templateEntity.prop,
                variables: templateEntity.variables,
            });
            entities[templateString] = questItem.item;
        }
    }

    const quest: QuestEntity = {
        quest: questId,
        template: template.template,
        entityIds: Object.values(entities),
        fulfilled: false,
        description: substituteVariables(template.description, entities),
        objectives: substituteVariablesRecursively(
            template.objectives,
            entities,
        ),
        entities,
        reward,
    };

    return (await questRepository.save(questId, quest)) as QuestEntity;
}

async function createQuestWrit(quest: QuestEntity): Promise<ItemEntity> {
    // The initial loc=[quest] locT="quest"
    return (await spawnQuestItem({
        quest: quest.quest,
        prop: compendium.questwrit.prop,
        variables: {
            desription: quest.description,
            quest: quest.quest,
        },
    })) as ItemEntity;
}

async function resolvePlayerQuests(
    player: PlayerEntity,
    entities: string[],
    triggerPredicate: (trigger: Trigger) => boolean,
) {
    const quests = await playerQuestsInvolvingEntities(player.player, entities);

    for (const [quest, writ] of quests) {
        // Find any trigger matches
        for (const objective of quest.objectives) {
            if (!objective.fulfilled) {
                const { trigger, effect, reward } = objective;

                // Check objective and trigger
                if (objective.fulfilled || !triggerPredicate(trigger)) {
                    return;
                }

                // Handle drop effect
                if (effect.type === "drop") {
                    await resolveDropEffect(
                        player,
                        effect,
                        // Publish received drop item to killer
                        async (droppedItem) => {
                            await publishFeedEvent(player.player, {
                                type: "message",
                                message: `You received ${droppedItem.name}.`,
                            });
                        },
                    );
                } else if (effect.type === "dialogue") {
                    // Publish dialogue
                    await publishFeedEvent(player.player, {
                        type: "message",
                        message: effect.dialogue,
                        variables: {
                            player: player.name,
                        },
                    });
                }

                // Resolve quest objective
                await resolveQuestObjective(player, quest, writ, objective);
            }
        }
    }
}

async function resolveDropEffect(
    player: PlayerEntity,
    effect: DropEffect,
    dropped: (item: ItemEntity) => Promise<void>,
) {
    // Drop effect item into killer's inventory
    let dropItem = (await fetchEntity(effect.item)) as ItemEntity;
    dropItem.loc = [player.player];
    dropItem.locT = "inv";
    dropItem.locI = LOCATION_INSTANCE;
    await saveEntity(dropItem);

    // Callback
    await dropped(dropItem);
}

async function resolveQuestObjective(
    player: PlayerEntity,
    quest: QuestEntity,
    writ: ItemEntity,
    objective: Objective,
) {
    // Set fulfilled on objective and/or quest
    objective.fulfilled = true;
    quest.fulfilled = Object.values(quest.objectives).every((o) => o.fulfilled);
    let questMessage = `You completed '${objective.description}'.`;
    if (quest.fulfilled) {
        questMessage += `The quest '${quest.description}' is completed.`;
        // Delete quest & writs (do not delete quest items - they can be used for crafting)
        await questRepository.remove(quest.quest);
        await itemRepository.remove(writ.item);
    } else {
        await saveEntity(quest);
    }

    // Allocate objective and/or quest rewards
    if (objective.reward) {
        player = await resolveQuestReward(player, objective.reward);
    }
    if (quest.fulfilled && quest.reward) {
        player = await resolveQuestReward(player, quest.reward);
    }

    // Publish objective/quest complete message
    await publishFeedEvent(player.player, {
        type: "message",
        message: questMessage,
    });

    // Perform a look & inventory (replace) for killer entity to update his inventory
    await look(player, { inventory: true });
}

async function resolveQuestReward<T extends PlayerEntity | MonsterEntity>(
    entity: T,
    reward: Reward,
): Promise<T> {
    if (reward.lum) {
        entity.lum += reward.lum;
    }
    if (reward.umb) {
        entity.umb += reward.umb;
    }
    if (reward.items) {
        for (const item of reward.items) {
            let rewardItem = (await fetchEntity(item)) as ItemEntity;
            rewardItem.loc = [getEntityId(entity)[0]];
            rewardItem.locT = "inv";
            rewardItem.locI = LOCATION_INSTANCE;
            await saveEntity(rewardItem);
        }
    }
    if (reward.props) {
        for (const prop of reward.props) {
            await spawnItemInInventory({
                entity: entity,
                prop,
            });
        }
    }
    return await saveEntity(entity);
}
