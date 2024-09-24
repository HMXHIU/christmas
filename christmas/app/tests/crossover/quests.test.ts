import { createQuest } from "$lib/server/crossover/quests";
import { initializeClients } from "$lib/server/crossover/redis";
import { killAndDeliverQuest } from "$lib/server/crossover/settings/quests";
import { expect, test } from "vitest";
import { createGandalfSarumanSauron } from "./utils";

await initializeClients(); // create redis repositories

let { geohash, playerOne, playerTwo } = await createGandalfSarumanSauron();

test("Test `createQuest`", async () => {
    var quest = await createQuest(killAndDeliverQuest);

    const { beast, npc, trophy } = quest.entities;

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
    });
});
