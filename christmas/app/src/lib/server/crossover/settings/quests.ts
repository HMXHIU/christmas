import { compendium } from "$lib/crossover/world/settings/compendium";
import type { QuestTemplate } from "../quests/types";

export { killAndDeliverQuest };

const killAndDeliverQuest: QuestTemplate = {
    template: "killAndDeliver",
    description:
        "You have been tasked to kill ${beast} and deliver it to ${npc}",
    entities: {
        trophy: {
            type: "item",
            prop: compendium.questitem.prop,
            variables: {
                description:
                    "${beast} head, ${npc} might be interested in this",
            },
        },
        beast: {
            type: "beast",
        },
        npc: {
            type: "npc",
        },
    },
    objectives: [
        {
            description: "kill ${beast}",
            trigger: {
                type: "kill",
                entity: "${beast}",
            },
            effect: {
                type: "drop",
                item: "${trophy}",
            },
            fulfilled: false,
        },
        {
            description: "deliver ${trophy} to ${npc}",
            trigger: {
                type: "give",
                give: "${trophy}",
                to: "${npc}",
            },
            effect: {
                type: "dialogue",
                dialogue: "Thank you ${player}!",
            },
            fulfilled: false,
        },
    ],
};
