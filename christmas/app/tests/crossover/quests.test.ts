import {
    crossoverCmdGive,
    crossoverCmdPerformAbility,
    crossoverCmdSay,
} from "$lib/crossover/client";
import type { ItemEntity, PlayerEntity } from "$lib/crossover/types";
import { minifiedEntity } from "$lib/crossover/utils";
import { LOCATION_INSTANCE } from "$lib/crossover/world/settings";
import { abilities } from "$lib/crossover/world/settings/abilities";
import type { GeohashLocationType } from "$lib/crossover/world/types";
import { consumeResources } from "$lib/server/crossover";
import { spawnMonster } from "$lib/server/crossover/dungeonMaster";
import { awardKillCurrency } from "$lib/server/crossover/entity";
import { generateNPC, type NPCs } from "$lib/server/crossover/npc";
import { createQuest, createQuestWrit } from "$lib/server/crossover/quests";
import { initializeClients } from "$lib/server/crossover/redis";
import {
    fetchEntity,
    fetchQuest,
    saveEntity,
} from "$lib/server/crossover/redis/utils";
import { killAndDeliverQuest } from "$lib/server/crossover/settings/quests";
import { clone } from "lodash-es";
import { beforeEach, expect, test } from "vitest";
import {
    collectAllEventDataForDuration,
    createGandalfSarumanSauron,
} from "./utils";

await initializeClients(); // create redis repositories

let { playerOne, playerTwo, playerThree, playerOneCookies, playerOneStream } =
    await createGandalfSarumanSauron();

beforeEach(async () => {
    playerOne.mnd = 10;
    playerOne.cha = 10;
    playerOne.skills.exploration = 10;
    playerOne = await saveEntity(playerOne);
});

test("Test Quest in NPC Greet Dialogue", async () => {
    const quest = await createQuest(killAndDeliverQuest);
    const { beast, npc, trophy } = quest.entities;
    let questWrit = await createQuestWrit(quest);

    const npcEntity = await generateNPC(npc as NPCs, {
        demographic: {},
        appearance: {},
        geohash: playerOne.loc[0],
        locationInstance: LOCATION_INSTANCE,
    });

    // Put `questWrit` in NPCs inventory
    questWrit.loc = [npcEntity.player];
    questWrit.locT = "inv";
    questWrit.locI = LOCATION_INSTANCE;
    questWrit = await saveEntity(questWrit);

    // Check quest appears in when greeting the NPC
    crossoverCmdSay(
        { target: npcEntity.player, message: "" },
        { Cookie: playerOneCookies },
    );
    var evs = await collectAllEventDataForDuration(playerOneStream);
    expect(evs).toMatchObject({
        feed: [
            {
                type: "message",
                message: "${message}",
                variables: {
                    cmd: "say",
                    player: npcEntity.player,
                    name: "Grocer",
                    message: `Quests:\n\nYou have been tasked to kill ${beast} and deliver it to ${npc} *${quest.quest}*\n\nYou can *ask Grocer about [quest]*`,
                },
                event: "feed",
            },
        ],
        entities: [],
        cta: [],
        action: [],
    });

    // Ask about quest
    crossoverCmdSay(
        { target: npcEntity.player, message: `about ${quest.quest}` },
        { Cookie: playerOneCookies },
    );
    var evs = await collectAllEventDataForDuration(playerOneStream);
    expect(evs).toMatchObject({
        feed: [
            {
                type: "message",
                message: "${name} says ${message}",
                variables: {
                    cmd: "say",
                    player: npcEntity.player,
                    name: "Grocer",
                    message: `You have been tasked to kill goblin and deliver it to grocer\n\nYou can *tell Grocer accept ${quest.quest}* to accept this quest`,
                },
                event: "feed",
            },
        ],
        entities: [],
        cta: [],
        action: [],
    });

    // Accept quest
    crossoverCmdSay(
        { target: npcEntity.player, message: `accept ${quest.quest}` },
        { Cookie: playerOneCookies },
    );
    var evs = await collectAllEventDataForDuration(playerOneStream);
    expect(evs).toMatchObject({
        feed: [
            {
                type: "message",
                message: "${message}",
                variables: {
                    cmd: "say",
                    player: npcEntity.player,
                    name: "Grocer",
                    message:
                        "Grocer hands you a Quest writ with a smile, 'Here you go, Gandalf. Hope it serves you well.'",
                },
                event: "feed",
            },
            {
                type: "message",
                message: "${name} says ${message}",
                variables: {
                    cmd: "say",
                    player: npcEntity.player,
                    name: "Grocer",
                    message: "Here is the quest writ, good luck Gandalf.",
                },
                event: "feed",
            },
        ],
        entities: [
            {
                event: "entities",
                players: [],
                monsters: [],
                items: [
                    {
                        item: questWrit.item,
                        prop: "questwrit",
                        loc: [playerOne.player],
                        locT: "inv",
                        locI: "@",
                        state: "default",
                        vars: {
                            quest: quest.quest,
                        },
                    },
                ],
                op: "upsert",
            },
        ],
        cta: [],
        action: [],
    });

    // Check quest writ has been transfered from NPC to player
    questWrit = (await fetchEntity(questWrit.item)) as ItemEntity;
    expect(questWrit.loc[0]).toBe(playerOne.player);
});

test("Test `createQuest` & `createQuestWrit`", async () => {
    const quest = await createQuest(killAndDeliverQuest);
    const { beast, npc, trophy } = quest.entities;

    // Check Quest
    expect(quest).toMatchObject({
        quest: quest.quest,
        template: quest.template,
        entityIds: [`${trophy}`, `${beast}`, `${npc}`],
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
    let questWrit = await createQuestWrit(quest);
    expect(questWrit).toMatchObject({
        item: questWrit.item,
        name: "Quest writ",
        prop: "questwrit",
        loc: [quest.quest],
        locT: "quest",
        locI: "@",
    });

    // Put `questWrit` in `playerOne` inventory
    questWrit.locT = "inv";
    questWrit.loc = [playerOne.player];
    questWrit = await saveEntity(questWrit);

    // Spawn the quest beast
    const monster = await spawnMonster({
        geohash: playerOne.loc[0],
        locationType: playerOne.locT as GeohashLocationType,
        locationInstance: playerOne.locI,
        beast,
    });

    // Complete Objective 1 - `playerOne` kill the `beast` should trigger the drop of the `trophy`
    crossoverCmdPerformAbility(
        {
            target: monster.monster,
            ability: abilities.disintegrate.ability,
        },
        { Cookie: playerOneCookies },
    );
    var evs = await collectAllEventDataForDuration(playerOneStream);

    // Get playerOne states
    const playerOneAfterKillMonster = minifiedEntity(
        await awardKillCurrency(
            await consumeResources(
                playerOne,
                abilities.disintegrate.cost,
                false,
            ),
            monster,
            false,
        ),
        { stats: true },
    ) as PlayerEntity;

    const playerOneAfterObjectiveOne = clone(playerOneAfterKillMonster);
    playerOneAfterObjectiveOne.lum += quest.objectives[0]?.reward?.lum || 0;
    playerOneAfterObjectiveOne.umb += quest.objectives[0]?.reward?.umb || 0;

    const playerOneAfterQuest = clone(playerOneAfterObjectiveOne);
    playerOneAfterQuest.lum += quest.objectives[1]?.reward?.lum || 0;
    playerOneAfterQuest.umb += quest.objectives[1]?.reward?.umb || 0;
    playerOneAfterQuest.lum += quest.reward?.lum || 0;
    playerOneAfterQuest.umb += quest.reward?.umb || 0;

    expect(evs).toMatchObject({
        feed: [
            {
                message: "Gandalf drains goblin, dealing 55 damage!",
            },
            {
                message: "You killed goblin, it collapses at your feet.",
            },
            {
                message: "You received Quest item.",
            },
            {
                message: "You completed 'kill goblin'.",
            },
        ],
        entities: [
            {
                players: [
                    {
                        player: playerOne.player,
                    },
                ],
                monsters: [],
                items: [],
                op: "upsert",
            },
            {
                players: [],
                monsters: [
                    {
                        monster: monster.monster,
                    },
                ],
                items: [],
                op: "upsert",
            },
            {
                players: [playerOneAfterKillMonster],
                monsters: [],
                items: [],
                op: "upsert",
            },
            // From performing a look & inventory
            {
                players: [
                    playerOneAfterObjectiveOne,
                    {
                        player: playerTwo.player,
                    },
                    {
                        player: playerThree.player,
                    },
                ],
                monsters: [
                    {
                        monster: monster.monster,
                    },
                ],
                items: [
                    {
                        item: questWrit.item,
                        prop: "questwrit",
                        loc: [playerOne.player],
                        locT: "inv",
                        locI: "@",
                        vars: {
                            quest: quest.quest,
                        },
                    },
                    {
                        item: trophyEntity.item,
                        prop: "questitem",
                        loc: [playerOne.player],
                        locT: "inv",
                        locI: "@",
                        vars: {
                            description:
                                "${beast} head, ${npc} might be interested in this",
                        },
                    },
                ],
                op: "replace",
            },
        ],
        cta: [],
        action: [
            {
                ability: "disintegrate",
                source: playerOne.player,
                target: monster.monster,
                event: "action",
            },
        ],
    });

    // Spawn the npc
    const npcEntity = await generateNPC(npc as NPCs, {
        demographic: {},
        appearance: {},
        geohash: playerOne.loc[0],
        locationInstance: LOCATION_INSTANCE,
    });

    // Complete Objective 2 - `playerOne` give `trophy` to `npc`
    crossoverCmdGive(
        { item: trophyEntity.item, receiver: npcEntity.player },
        { Cookie: playerOneCookies },
    );
    var evs = await collectAllEventDataForDuration(playerOneStream);
    expect(evs).toMatchObject({
        feed: [
            {
                message: "${message}",
                variables: {
                    cmd: "say",
                    player: npcEntity.player,
                    name: "Grocer",
                    message:
                        "Grocer beams with gratitude as they nod to you, 'Ah, many thanks for the Quest item, Gandalf!'",
                },
            },
            {
                message: "Thank you ${player}!",
                variables: {
                    player: "Gandalf",
                },
            },
            {
                message: `You completed 'deliver ${trophyEntity.item} to ${npc}'.The quest 'You have been tasked to kill ${beast} and deliver it to ${npc}' is completed.`,
            },
        ],
        entities: [
            {
                event: "entities",
                players: [],
                monsters: [],
                items: [
                    {
                        item: trophyEntity.item,
                        loc: [npcEntity.player], // item should be moved to npc inventory
                        locT: "inv",
                        locI: "@",
                    },
                ],
                op: "upsert",
            },
            {
                players: [
                    playerOneAfterQuest, // playerOne should have gotten all the rewards
                    {
                        player: playerTwo.player,
                    },
                    {
                        player: playerThree.player,
                    },
                    {
                        player: npcEntity.player,
                    },
                ],
                monsters: [
                    {
                        monster: monster.monster,
                    },
                ],
                items: [],
                op: "replace",
            },
        ],
        cta: [],
        action: [],
    });

    // Check quest writ and quest removed
    expect(fetchQuest(quest.quest)).resolves.toBeNull();
    expect(fetchEntity(questWrit.item)).resolves.toBeNull();
});
