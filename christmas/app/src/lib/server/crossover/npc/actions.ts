import type { Monster, Player } from "$lib/crossover/types";
import type { Abilities } from "$lib/crossover/world/abilities";
import type {
    DialogueEntity,
    ItemEntity,
    PlayerEntity,
} from "$lib/server/crossover/types";
import { substituteVariables } from "$lib/utils";
import { say } from "../actions";
import { executeGiveCTA, give } from "../actions/give";
import { executeLearnCTA } from "../actions/learn";
import {
    type P2PGiveTransaction,
    type P2PLearnTransaction,
    type P2PTradeTransaction,
} from "../player";
import { questWritsQuerySet } from "../redis/queries";
import { fetchEntity, fetchQuest } from "../redis/utils";
import type { NPCs } from "./types";
import { isEntityHuman, searchDialogues } from "./utils";

export {
    npcRespondToAbility,
    npcRespondToGive,
    npcRespondToGreet,
    npcRespondToLearn,
    npcRespondToMessage,
    npcRespondToTrade,
};

async function npcRespondToTrade(npc: string, p2pTradeTx: P2PTradeTransaction) {
    const npcEntity = (await fetchEntity(npc)) as PlayerEntity;
    // TODO: Check if any writs on npc meets the offer/receive and execute it

    // Redirect player to *browse* wares
    await say(
        npcEntity,
        "I’m not certain I have exactly what you seek, but why not take a moment to *browse* through my wares? Perhaps something else will catch your eye.",
        {
            target: p2pTradeTx.buyer,
        },
    );
}

async function npcRespondToLearn(npc: string, p2pLearnTx: P2PLearnTransaction) {
    const npcEntity = (await fetchEntity(npc)) as PlayerEntity;
    await executeLearnCTA(npcEntity, p2pLearnTx);
}

async function npcRespondToGive(npc: string, p2pGiveTx: P2PGiveTransaction) {
    const npcEntity = (await fetchEntity(npc)) as PlayerEntity;
    await executeGiveCTA(npcEntity, p2pGiveTx);
}

async function npcRespondToMessage(
    npc: string,
    player: string,
    message: string,
) {
    const npcEntity = (await fetchEntity(npc)) as PlayerEntity;

    const tokens = message.split(" ");

    // Asked about quest (*ask [npc] about [quest]*)
    if (tokens[0] === "about" && tokens[1].startsWith("quest_")) {
        const quest = await fetchQuest(tokens[1]);
        if (quest) {
            // Check if NPC has the quest writ
            const writs = (await questWritsQuerySet(
                npc,
            ).returnAll()) as ItemEntity[];
            if (writs.some((w) => w.vars.quest === quest.quest)) {
                await say(
                    npcEntity,
                    `${quest.description}\n\nYou can *tell ${npcEntity.name} accept ${quest.quest}* to accept this quest`,
                    {
                        target: player,
                    },
                );
            }
        }
    }
    // Request to accept quest (*tell [npc] accept [quest]*)
    else if (tokens[0] === "accept" && tokens[1].startsWith("quest_")) {
        const quest = await fetchQuest(tokens[1]);
        if (quest) {
            // Check if NPC has the quest writ
            const writs = (await questWritsQuerySet(
                npc,
            ).returnAll()) as ItemEntity[];
            const writEntity = writs.find((w) => w.vars.quest === quest.quest);
            if (writEntity) {
                const playerEntity = (await fetchEntity(
                    player,
                )) as PlayerEntity;
                // Give writ to player
                await give(npcEntity, playerEntity, writEntity);
            }
        }
    }
    // TODO: LLM response
    else {
        await say(npcEntity, `${npcEntity.name} ignores you.`, {
            target: player,
            overwrite: true,
        });
    }
}

async function npcRespondToGreet(npc: string, player: string) {
    const playerEntity = (await fetchEntity(player)) as PlayerEntity;
    const npcEntity = (await fetchEntity(npc)) as PlayerEntity;
    const npcTemplate = npcEntity.npc?.split("_")[0] as NPCs;
    const tags = [`npc=${npcTemplate}`];
    let dialogue = await npcGreetResponse(tags);

    // Check if NPC has any quests
    let questMessage = "";
    const questWrits = (await questWritsQuerySet(
        npc,
    ).returnAll()) as ItemEntity[];
    if (questWrits.length > 0) {
        questMessage += `Quests:\n`;
        for (const qr of questWrits) {
            if (qr.vars.quest) {
                const quest = await fetchQuest(qr.vars.quest as string);
                if (quest) {
                    questMessage += `\n${quest?.name} *${quest.quest}*`;
                }
            }
        }
        questMessage += `\n\nYou can *ask ${npcEntity.name} about [quest]*`;
    }

    if (dialogue) {
        await say(
            npcEntity,
            substituteVariables(dialogue.msg, {
                self: npcEntity,
                player: playerEntity,
            }),
            {
                target: playerEntity.player,
                overwrite: true,
            },
        );
    }

    if (questMessage) {
        await say(npcEntity, questMessage, {
            target: playerEntity.player,
            overwrite: true,
        });
    }
}

async function npcGreetResponse(
    tags: string[],
): Promise<DialogueEntity | undefined> {
    // Search for greeting dialogue
    let dialogues = await searchDialogues("grt", tags);

    // Search for ignore dialogue
    if (dialogues.length < 1) {
        dialogues = await searchDialogues("ign", tags);
    }

    // Get best dialogue
    const dialogue = dialogues[0];

    return dialogue;
}

async function npcRespondToAbility({
    entity,
    target,
    ability,
}: {
    entity: Player | Monster;
    target: Player;
    ability: Abilities;
}) {
    if (target.npc) {
        const npc = target.npc.split("_")[0] as NPCs;
        const entityIsHuman = isEntityHuman(entity);

        // Dialogues spoken directly to an actual player
        if (isEntityHuman(entity)) {
        }
        // Dialogues spoken to all
        else {
        }
    }
}
