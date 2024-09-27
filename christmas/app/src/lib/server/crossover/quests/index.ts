import type {
    DropEffect,
    Objective,
    Quest,
    Reward,
    Trigger,
} from "$lib/crossover/types";
import { getEntityId } from "$lib/crossover/utils";
import { LOCATION_INSTANCE } from "$lib/crossover/world/settings";
import { bestiary } from "$lib/crossover/world/settings/bestiary";
import { compendium } from "$lib/crossover/world/settings/compendium";
import type {
    ItemEntity,
    MonsterEntity,
    PlayerEntity,
} from "$lib/server/crossover/types";
import {
    generateRandomSeed,
    sampleFrom,
    substituteVariables,
    substituteVariablesRecursively,
} from "$lib/utils";
import { look } from "../actions";
import { spawnItemInInventory, spawnQuestItem } from "../dungeonMaster";
import { publishFeedEvent } from "../events";
import type { NPCs } from "../npc/types";
import { itemRepository, questRepository } from "../redis";
import { playerQuestsInvolvingEntities } from "../redis/queries";
import { fetchEntity, saveEntity } from "../redis/utils";
import { npcs } from "../settings/npc";
import { random } from "../utils";
import type { QuestEntity, QuestTemplate } from "./types";

export {
    createQuest,
    createQuestWrit,
    resolveDropEffect,
    resolvePlayerQuests,
    resolveQuestObjective,
    resolveQuestReward,
};

async function createQuest(
    template: QuestTemplate,
    options?: { beasts?: string[]; npcs?: NPCs[]; reward?: Reward },
): Promise<QuestEntity> {
    const entities: Record<string, { id?: string; name: string }> = {};
    const questId = `quest_${template.template}-${await questRepository.search().count()}`;

    // Randomly determine beasts, NPCs selection
    const reward = options?.reward ?? {};
    const beasts = options?.beasts ?? Object.keys(bestiary);
    const npcTypes = options?.npcs ?? Object.keys(npcs);

    // Determine entities (that do no need to be spawned)
    for (const [templateString, templateEntity] of Object.entries(
        template.entities,
    )) {
        // Beast
        if (templateEntity.type === "beast") {
            const beast = sampleFrom(
                beasts,
                1,
                generateRandomSeed(random()),
            )[0];
            entities[templateString] = {
                id: beast,
                name: beast,
            };
        }
        // NPC
        else if (templateEntity.type === "npc") {
            const npc = sampleFrom(
                npcTypes,
                1,
                generateRandomSeed(random()),
            )[0];
            entities[templateString] = {
                id: npc,
                name: npcs[npc as NPCs].nameTemplate,
            };
        }
    }

    // Determine entities (that have secondary dependencies)
    for (const [templateString, templateEntity] of Object.entries(
        template.entities,
    )) {
        // Trophy
        if (templateEntity.type === "trophy") {
            const { beast, npc } = substituteVariablesRecursively(
                templateEntity,
                entities,
            );
            const trophy = sampleFrom(
                bestiary[beast].trophies[npc as NPCs] ?? ["head"],
                1,
                generateRandomSeed(random()),
            )[0];
            entities[templateString] = {
                name: trophy, // trophy has no id
            };
        }
    }

    // Determine entities (to be spawned)
    for (const [templateString, templateEntity] of Object.entries(
        template.entities,
    )) {
        // Item
        if (templateEntity.type === "item") {
            // Quest items are spawned at loc=[quest] locT="quest"
            const questItem = await spawnQuestItem({
                quest: questId,
                prop: templateEntity.prop,
                variables: {
                    quest: questId, // always add quest variable to any quest items generated
                    ...substituteVariablesRecursively(
                        templateEntity.variables,
                        entities,
                    ),
                },
            });
            entities[templateString] = {
                id: questItem.item,
                name: questItem.name,
            };
        }
    }

    const quest: Quest = {
        quest: questId,
        template: template.template,
        name: substituteVariables(template.name, entities),
        description: substituteVariables(template.description, entities),
        objectives: substituteVariablesRecursively(
            template.objectives,
            entities,
        ),
        entityIds: Object.values(entities)
            .map((e) => e.id)
            .filter((e) => e != undefined),
        reward,
        fulfilled: false,
    };

    return await saveEntity(quest as QuestEntity);
}

async function createQuestWrit(quest: QuestEntity): Promise<ItemEntity> {
    // The initial loc=[quest] locT="quest"
    return (await spawnQuestItem({
        quest: quest.quest,
        prop: compendium.questwrit.prop,
        variables: {
            name: quest.name,
            description: quest.description,
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
                        message: substituteVariables(effect.dialogue, {
                            player: player.name,
                        }),
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
        questMessage += `\nThe quest '${quest.name}' is completed.`;
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
