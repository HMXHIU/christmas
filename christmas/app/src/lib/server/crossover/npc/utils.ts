import type { Dialogues, GameEntity } from "$lib/crossover/types";
import { isPublicKeyNPCCache } from "../caches";
import { dialogueRepository } from "../redis";
import { fetchEntity } from "../redis/utils";
import type { DialogueEntity } from "../types";

export { isEntityHuman, isEntityNPC, isPublicKeyNPC, searchDialogues };

async function searchDialogues(
    dialogue: Dialogues,
    tags: string[],
): Promise<DialogueEntity[]> {
    // Note: OR and MUST are mutually exclusive (choose either OR or MUST when defining the dialogue)
    let query = dialogueRepository
        .search()
        .where("dia")
        .equal(dialogue)
        .and("exc")
        .does.not.containsOneOf(...tags);

    // Check or condition
    let dialogues = (await query
        .and("or")
        .containsOneOf(...tags)
        .returnAll()) as DialogueEntity[];

    // Check must condition - 2 Step process (first get all relevant entries, then manually filter)
    if (dialogues.length < 1) {
        dialogues = (await tags
            .reduce((acc, c) => acc.or("mst").contains(c), query)
            .returnAll()) as DialogueEntity[];
        dialogues = dialogues.filter(
            (d) => d.mst && d.mst.every((t) => tags.includes(t)),
        );
    }

    return dialogues;
}

function isEntityNPC(entity: GameEntity): boolean {
    if ("player" in entity && entity.npc) {
        return true;
    }
    return false;
}

function isEntityHuman(entity: GameEntity): boolean {
    if ("player" in entity && !entity.npc) {
        return true;
    }
    return false;
}

async function isPublicKeyNPC(publicKey: string): Promise<boolean> {
    const cached = await isPublicKeyNPCCache.get(publicKey);
    if (cached !== undefined) {
        return cached;
    }
    const isNPC = Boolean((await fetchEntity(publicKey))?.npc);
    await isPublicKeyNPCCache.set(publicKey, isNPC);
    return isNPC;
}
