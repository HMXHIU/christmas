import { type ItemEntity, type PlayerEntity } from "$lib/crossover/types";
import { LOCATION_INSTANCE } from "$lib/crossover/world/settings";
import { generatePin } from "$lib/utils";
import { say } from ".";
import { publishAffectedEntitiesToPlayers, publishFeedEvent } from "../events";
import { isEntityHuman } from "../npc";
import {
    createP2PTransaction,
    type CTA,
    type P2PGiveTransaction,
} from "../player";
import { itemRepository } from "../redis";
import { fetchEntity } from "../redis/utils";

export { createGiveCTA, executeGiveCTA, give };

async function executeGiveCTA(
    executor: PlayerEntity,
    p2pGiveTx: P2PGiveTransaction,
    writ?: ItemEntity, // writ to destroy once fulfilled
) {
    const { receiver, item, player } = p2pGiveTx;

    // Check that the player executing the p2pGiveTx is the receiver
    if (executor.player !== receiver) {
        publishFeedEvent(executor.player, {
            type: "error",
            message: `You try to execute the agreement, but it rejects you with a slight jolt.`,
        });
    }

    await give(
        (await fetchEntity(player)) as PlayerEntity,
        (await fetchEntity(receiver)) as PlayerEntity,
        (await fetchEntity(item)) as ItemEntity,
        writ,
    );
}

async function createGiveCTA(
    player: PlayerEntity,
    receiver: PlayerEntity,
    item: ItemEntity,
): Promise<CTA> {
    // Receiver must be a human player
    if (isEntityHuman(receiver)) {
        const expiresIn = 60;
        const pin = generatePin(4);
        const giveTx: P2PGiveTransaction = {
            transaction: "give",
            receiver: receiver.player,
            player: player.player,
            item: item.item,
        };
        return {
            name: "Gift",
            description: `${player.name} wants to give ${item.name} to you. You have ${expiresIn} to *accept ${pin}*`,
            token: await createP2PTransaction(giveTx, 60),
            pin,
        };
    }

    throw new Error("Receiver is not a player");
}

async function give(
    player: PlayerEntity,
    receiver: PlayerEntity,
    item: ItemEntity,
    writ?: ItemEntity,
) {
    // Check if player can give receiver
    const [ok, cannotGiveMessage] = canGive(player, receiver, item);
    if (!ok) {
        publishFeedEvent(player.player, {
            type: "error",
            message: cannotGiveMessage,
        });
        return;
    }

    // Transfer items
    item.loc = [receiver.player];
    item.locT = "inv";
    item.locI = LOCATION_INSTANCE;

    // Destroy writ if provided
    if (writ) {
        await itemRepository.remove(writ.item);
    }

    // Send entities
    publishAffectedEntitiesToPlayers([item], {
        publishTo: [player.player, receiver.player],
        op: "upsert",
    });

    // Send messages
    say(
        receiver,
        `${receiver.name} beams with gratitude as they nod to you, 'Ah, many thanks for the ${item.name}, ${player.name}!'`,
        { target: player.player, overwrite: true },
    );
    say(
        player,
        `${player.name} hands you a ${item.name} with a smile, 'Here you go, ${receiver.name}. Hope it serves you well.'`,
        { target: receiver.player, overwrite: true },
    );
}

function canGive(
    player: PlayerEntity,
    receiver: PlayerEntity,
    item: ItemEntity,
): [boolean, string] {
    if (!receiver) {
        return [false, "Who are you giving to?"];
    }
    if (!item) {
        return [false, "What are you trying to give?"];
    }
    if (item.loc[0] !== player.player) {
        return [false, `You do not own ${item.name}.`];
    }
    if (item.locT !== "inv") {
        return [false, `${item.name} is not in your inventory.`];
    }
    return [true, ""];
}
