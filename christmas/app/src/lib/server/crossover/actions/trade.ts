import {
    type Barter,
    type BarterSerialized,
    type Currency,
    type GeohashLocationType,
} from "$lib/crossover/world/types";
import { generatePin } from "$lib/utils";
import { say } from ".";
import { setEntityBusy } from "..";
import { isEntityActualPlayer } from "../npc";
import {
    createP2PTransaction,
    type CTA,
    type P2PTradeTransaction,
} from "../player";
import { fetchEntity, getNearbyPlayerIds, saveEntity } from "../redis";
import { type ItemEntity, type PlayerEntity } from "../redis/entities";
import {
    publishActionEvent,
    publishAffectedEntitiesToPlayers,
    publishFeedEvent,
    savePlayerState,
} from "../utils";

export {
    createTradeCTA,
    deserializeBarter,
    executeTradeCTA,
    setEntityBusy,
    trade,
};

function playerHasBarterItems(player: PlayerEntity, barter: Barter): boolean {
    // Check player as all barter items in inventory
    for (const item of barter.items || []) {
        if (item.locT !== "inv" || item.loc[0] !== player.player) {
            return false;
        }
    }
    // Check player has all barter currencies
    for (const [cur, amt] of Object.entries(barter.currency)) {
        if (player[cur as Currency] < amt) {
            return false;
        }
    }
    return true;
}

function canTradeWith(
    player: PlayerEntity,
    trader: PlayerEntity,
    offer: Barter,
    receive: Barter,
): [boolean, string] {
    // Check if trader is a player
    if (!trader.player || !player.player) {
        return [false, "You might as well try to trade with a rock."];
    }

    // Check trader and player has required items/currencies
    if (!playerHasBarterItems(player, offer)) {
        return [
            false,
            `${player.name} does not have the items or currencies needed to barter.`,
        ];
    }
    if (!playerHasBarterItems(trader, receive)) {
        return [
            false,
            `${trader.name} does not have the items or currencies needed to barter.`,
        ];
    }

    return [true, ""];
}

function barterDescription(barter: Barter): string {
    const itemsDescription = barter.items.map((i) => i.name).join(", ");
    const currenciesDescription = Object.entries(barter.currency)
        .filter(([cur, amt]) => amt > 0)
        .map(([cur, amt]) => `${amt} ${cur}`)
        .join(", ");

    return [itemsDescription, currenciesDescription]
        .filter((s) => Boolean(s))
        .join(", ");
}

function barterDialogue(
    barter: Barter,
    from: PlayerEntity,
    to: PlayerEntity,
): string {
    const barterDesc = barterDescription(barter);
    return `${from.name} hands you ${barterDesc}, 'Pleasure doing business with you, ${to.name}'`;
}

function serializeBarter(barter: Barter): BarterSerialized {
    return {
        items: barter.items.map((i) => i.item),
        currency: barter.currency,
    };
}

async function deserializeBarter(barter: BarterSerialized): Promise<Barter> {
    return {
        items: barter.items
            ? ((await Promise.all(
                  barter.items.map((i) => fetchEntity(i)),
              )) as ItemEntity[])
            : [],
        currency: {
            lum: barter?.currency?.lum ?? 0,
            umb: barter?.currency?.umb ?? 0,
        },
    };
}

async function createTradeCTA(
    player: PlayerEntity,
    trader: PlayerEntity,
    offer: Barter,
    receive: Barter,
): Promise<CTA> {
    // Trader is a human player - request a P2PTradeTransaction and terminate early
    if (isEntityActualPlayer(trader)) {
        const expiresIn = 60;
        const pin = generatePin(4);
        const offerDesc = barterDescription(offer);
        const receiveDesc = barterDescription(receive);
        const tradeTx: P2PTradeTransaction = {
            action: "trade",
            message: `${player.name} requests to trade with you. The offer is ${offerDesc} for ${receiveDesc}. You have ${expiresIn} to *accept ${pin}*`,
            trader: trader.player,
            player: player.player,
            offer: serializeBarter(offer),
            receive: serializeBarter(receive),
        };
        return {
            cta: "writ",
            name: "Trade Writ",
            description: `This writ allows you to trade ${offerDesc} for ${receiveDesc} from ${trader.name}.`,
            token: await createP2PTransaction(tradeTx, 60),
            pin,
        };
    }

    throw new Error("Trader is not a player");
}

async function executeTradeCTA(
    executor: PlayerEntity,
    writ: P2PTradeTransaction,
) {
    const { player, trader, offer, receive } = writ;
    const playerEntity = (await fetchEntity(player)) as PlayerEntity;
    const traderEntity = (await fetchEntity(trader)) as PlayerEntity;
    const barterOffer = await deserializeBarter(offer);
    const barterReceive = await deserializeBarter(receive);

    // Check that the player executing the writ is the trader
    if (executor.player !== trader) {
        publishFeedEvent(executor.player, {
            type: "error",
            message: `You try to execute the writ, but it rejects you with a slight jolt.`,
        });
    }

    // Need to check before executing so we can send any dialogues to the executor only
    const [canTrade, cannotTradeMessage] = canTradeWith(
        playerEntity,
        traderEntity,
        barterOffer,
        barterReceive,
    );
    if (!canTrade) {
        if (isEntityActualPlayer(executor)) {
            say(playerEntity, cannotTradeMessage, {
                target: executor.player,
                overwrite: true,
            });
        }
        return; // stop the execution
    }

    await trade(
        playerEntity, // get the player making the offer from the writ
        trader,
        barterOffer,
        barterReceive,
    );
}

async function trade(
    player: PlayerEntity,
    trader: string,
    offer: Barter,
    receive: Barter,
) {
    const playerIsHuman = isEntityActualPlayer(player);
    const traderEntity = (await fetchEntity(trader)) as PlayerEntity;
    const traderIsHuman = isEntityActualPlayer(traderEntity);

    const [canTrade, cannotTradeMessage] = canTradeWith(
        player,
        traderEntity,
        offer,
        receive,
    );

    // Cannot trade - send `cannotLearnMessage` back to player
    if (!canTrade && playerIsHuman) {
        await say(traderEntity, cannotTradeMessage, {
            target: player.player,
            overwrite: true,
        });
    }

    // Get nearby players
    const nearbyPlayerIds = await getNearbyPlayerIds(
        player.loc[0],
        player.locT as GeohashLocationType,
        player.locI,
    );

    // Publish action event
    publishActionEvent(nearbyPlayerIds, {
        action: "trade",
        source: trader,
        target: player.player,
    });

    // Transfer offer from player to trader
    for (const item of offer.items) {
        item.locT = "inv";
        item.loc[0] = traderEntity.player;
        await saveEntity(item);
    }
    for (const [cur, amt] of Object.entries(offer.currency)) {
        player[cur as Currency] -= amt;
        traderEntity[cur as Currency] += amt;
        await saveEntity(player);
        await saveEntity(traderEntity);
    }

    // Transfer receive from trader to player
    for (const item of receive.items) {
        item.locT = "inv";
        item.loc[0] = player.player;
        await saveEntity(item);
    }
    for (const [cur, amt] of Object.entries(receive.currency)) {
        traderEntity[cur as Currency] -= amt;
        player[cur as Currency] += amt;
        await saveEntity(player);
        await saveEntity(traderEntity);
    }

    // Save player's state to MINIO
    await savePlayerState(player.player);
    await savePlayerState(traderEntity.player);

    // Publish to nearby players
    publishAffectedEntitiesToPlayers(
        [player, traderEntity, ...offer.items, ...receive.items],
        {
            publishTo: [player.player, trader],
            op: "upsert",
        },
    );

    // Send dialogues
    if (playerIsHuman) {
        say(traderEntity, barterDialogue(receive, traderEntity, player), {
            target: player.player,
            overwrite: true,
        });
    }
    if (traderIsHuman) {
        say(player, barterDialogue(offer, player, traderEntity), {
            target: trader,
            overwrite: true,
        });
    }
}
