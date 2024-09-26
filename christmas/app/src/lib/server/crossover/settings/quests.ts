import { compendium } from "$lib/crossover/world/settings/compendium";
import type { QuestTemplate } from "../quests/types";

export { killAndDeliverQuest };

const killAndDeliverQuest: QuestTemplate = {
    template: "killAndDeliver",
    name: "Acquire ${package.name} for ${npc.name}",
    description:
        "${npc.name} is seeking to obtain a ${package.name} from the ${beast.name}s nearby.",
    entities: {
        package: {
            type: "item",
            prop: compendium.questitem.prop,
            variables: {
                name: "${beast.name}'s ${trophy.name}",
                description:
                    "A ${beast.name}'s ${trophy.name}, ${npc.name} might be interested in this.",
            },
        },
        beast: {
            type: "beast",
        },
        trophy: {
            type: "trophy",
            npc: "${npc.id}",
            beast: "${beast.id}",
        },
        npc: {
            type: "npc",
        },
    },
    objectives: [
        {
            description:
                "Hunt down ${beast.name} and obtain its ${trophy.name}.",
            trigger: {
                type: "kill",
                entity: "${beast.id}",
            },
            effect: {
                type: "drop",
                item: "${package.id}",
            },
            fulfilled: false,
        },
        {
            description: "Deliver the ${package.name} to ${npc.name}.",
            trigger: {
                type: "give",
                give: "${package.id}",
                to: "${npc.id}",
            },
            effect: {
                type: "dialogue",
                dialogue: "Thank you ${player}!",
            },
            fulfilled: false,
        },
    ],
};
