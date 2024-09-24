import type { ItemEntity } from "$lib/crossover/types";
import { createQuest, createQuestWrit } from "$lib/server/crossover/quests";
import { initializeClients } from "$lib/server/crossover/redis";
import { fetchEntity } from "$lib/server/crossover/redis/utils";
import { killAndDeliverQuest } from "$lib/server/crossover/settings/quests";
import { expect, test } from "vitest";
import { createGandalfSarumanSauron } from "./utils";

await initializeClients(); // create redis repositories

let { geohash, playerOne, playerTwo } = await createGandalfSarumanSauron();

test("Test `createQuest` & `createQuestWrit`", async () => {
    const quest = await createQuest(killAndDeliverQuest);

    const { beast, npc, trophy } = quest.entities;

    // Check Quest
    expect(quest).toMatchObject({
        quest: quest.quest,
        template: quest.template,
        description: `You have been tasked to kill ${beast} and deliver it to ${npc}`,
        objectives: [
            {
                description: `kill ${beast}`,
                trigger: {
                    type: `kill`,
                    entity: `${beast}`,
                },
                effect: {
                    type: `drop`,
                    item: `${trophy}`,
                },
            },
            {
                description: `deliver ${trophy} to ${npc}`,
                trigger: {
                    type: `give`,
                    give: `${trophy}`,
                    to: `${npc}`,
                },
                effect: {
                    type: `dialogue`,
                    dialogue: "Thank you ${player}!",
                },
            },
        ],
        entities: {
            trophy: `${trophy}`,
            beast: `${beast}`,
            npc: `${npc}`,
        },
        reward: quest.reward,
        fulfilled: false,
    });

    // Check Quest Item
    const trophyEntity = (await fetchEntity(trophy)) as ItemEntity;
    expect(trophyEntity).toMatchObject({
        item: trophy,
        name: "Quest item",
        prop: "questitem",
        loc: [quest.quest],
        locT: "quest",
        locI: "@",
        vars: {
            description: "${beast} head, ${npc} might be interested in this",
        },
    });

    // Check Quest Writ
    const questWrit = await createQuestWrit(quest);
    expect(questWrit).toMatchObject({
        item: questWrit.item,
        name: "Quest writ",
        prop: "questwrit",
        loc: [quest.quest],
        locT: "quest",
        locI: "@",
    });
});
