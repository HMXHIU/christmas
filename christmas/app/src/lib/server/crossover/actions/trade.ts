import { compendium } from "$lib/crossover/world/settings/compendium";
import {
    type Barter,
    type BarterSerialized,
    type Currency,
    type GeohashLocationType,
} from "$lib/crossover/world/types";
import { generatePin } from "$lib/utils";
import { say } from ".";
import { setEntityBusy } from "..";
import { spawnItemInInventory } from "../dungeonMaster";
import { isEntityHuman } from "../npc";
import {
    createP2PTransaction,
    type CTA,
    type P2PTradeTransaction,
} from "../player";
import {
    fetchEntity,
    getNearbyPlayerIds,
    itemRepository,
    saveEntity,
    writsQuerySet,
} from "../redis";
import { type ItemEntity, type PlayerEntity } from "../redis/entities";
import {
    publishActionEvent,
    publishAffectedEntitiesToPlayers,
    publishFeedEvent,
    savePlayerState,
} from "../utils";

export {
    browse,
    createTradeCTA,
    createTradeWrit,
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

function canTrade(
    buyer: PlayerEntity,
    seller: PlayerEntity,
    offer: Barter,
    receive: Barter,
): [boolean, string] {
    // Check if entities are players
    if (!seller.player || !buyer.player) {
        return [false, "You might as well try to trade with a rock."];
    }

    // Check seller and player has required items/currencies
    if (!playerHasBarterItems(buyer, offer)) {
        return [
            false,
            `${buyer.name} does not have ${barterDescription(offer)}.`,
        ];
    }
    if (!playerHasBarterItems(seller, receive)) {
        return [
            false,
            `${seller.name} does not have ${barterDescription(receive)}.`,
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

async function createTradeWrit({
    creator,
    buyer,
    seller,
    offer,
    receive,
    expiresIn,
}: {
    creator: PlayerEntity; // the creator creating the writ
    buyer: string; // "" to let anyone fulfill the order
    seller: string; // "" to let anyone fulfill the order
    offer: Barter;
    receive: Barter;
    expiresIn?: number;
}): Promise<ItemEntity> {
    if (creator.player !== seller && creator.player !== buyer) {
        throw new Error("Executor must be one of the buyer or seller");
    }

    expiresIn = expiresIn ?? 60 * 60 * 24; // 1 day
    const offerDesc = barterDescription(offer); // w.r.t to buyer
    const receiveDesc = barterDescription(receive);
    const tradeTx: P2PTradeTransaction = {
        transaction: "trade",
        seller,
        buyer,
        offer: serializeBarter(offer),
        receive: serializeBarter(receive),
    };

    const writ = await spawnItemInInventory({
        entity: creator,
        prop: compendium.tradewrit.prop,
        variables: {
            order: creator.player === seller ? "sell" : "buy",
            receive: receiveDesc,
            offer: offerDesc,
            token: await createP2PTransaction(tradeTx, expiresIn),
        },
    });

    publishFeedEvent(creator.player, {
        type: "message",
        message: "You received a trade writ in your inventory.",
    });

    return writ;
}

async function createTradeCTA(
    initiator: PlayerEntity,
    buyer: PlayerEntity,
    seller: PlayerEntity,
    offer: Barter,
    receive: Barter,
): Promise<CTA> {
    if (
        initiator.player !== seller.player &&
        initiator.player !== buyer.player
    ) {
        throw new Error("Executor must be one of the buyer or seller");
    }
    const expiresIn = 60; // for CTA, hardcode to 60 seconds
    const pin = generatePin(4);
    const offerDesc = barterDescription(offer);
    const receiveDesc = barterDescription(receive);
    const message =
        initiator.player === seller.player
            ? `${seller.name} is offering to sell ${receiveDesc} for ${offerDesc}.`
            : `${buyer.name} is offering to buy ${receiveDesc} for ${offerDesc}.`;

    const tradeTx: P2PTradeTransaction = {
        transaction: "trade",
        seller: seller.player,
        buyer: buyer.player,
        offer: serializeBarter(offer),
        receive: serializeBarter(receive),
    };
    return {
        name: "Trade Writ",
        description: `${message} You have ${expiresIn}s to *accept ${pin}*.`,
        token: await createP2PTransaction(tradeTx, expiresIn),
        pin,
    };
}

async function executeTradeCTA(
    executor: PlayerEntity,
    p2pTradeTx: P2PTradeTransaction,
    writ?: ItemEntity, // writ to destroy once fulfilled
) {
    const { buyer, seller, offer, receive } = p2pTradeTx;

    // The executor can take the roles of the seller or buyer from the writ, if not specified
    const buyerEntity = buyer
        ? ((await fetchEntity(buyer)) as PlayerEntity)
        : executor;
    const sellerEntity = seller
        ? ((await fetchEntity(seller)) as PlayerEntity)
        : executor;

    const barterOffer = await deserializeBarter(offer);
    const barterReceive = await deserializeBarter(receive);

    // Check that the executor must be one of the parties
    if (
        executor.player !== buyerEntity.player &&
        executor.player !== sellerEntity.player
    ) {
        publishFeedEvent(executor.player, {
            type: "error",
            message: `You try to execute the agreement, but it rejects you with a slight jolt.`,
        });
        return; // stop the execution
    }

    // Need to check before executing so we can send any dialogues to the executor only
    const [ok, cannotTradeMessage] = canTrade(
        buyerEntity,
        sellerEntity,
        barterOffer,
        barterReceive,
    );
    if (!ok) {
        if (isEntityHuman(executor)) {
            say(buyerEntity, cannotTradeMessage, {
                target: executor.player,
                overwrite: true,
            });
        }
        return; // stop the execution
    }

    await trade(buyerEntity, sellerEntity, barterOffer, barterReceive, writ);
}

async function browse(
    player: PlayerEntity,
    merchant: string,
): Promise<ItemEntity[]> {
    const merchantEntity = (await fetchEntity(merchant)) as PlayerEntity;

    const writs = (await writsQuerySet(
        merchantEntity.player,
    ).returnAll()) as ItemEntity[];
    const buyOrders = writs
        .filter(({ vars }) => vars.order === "buy")
        .map(({ vars, item }) => `${vars.receive} for ${vars.offer} [${item}]`)
        .join("\n");
    const sellOrders = writs
        .filter(({ vars }) => vars.order === "sell")
        .map(({ vars, item }) => `${vars.receive} for ${vars.offer} [${item}]`)
        .join("\n");

    let message = "";
    if (sellOrders) {
        message += `${merchantEntity.name} is offering to sell:\n\n${sellOrders}\n\n`;
    }
    if (buyOrders) {
        message += `And offering to buy:\n\n${buyOrders}\n\n`;
    }
    if (sellOrders || buyOrders) {
        message += "You may *fulfill writ* to execute a trade.";
    }

    publishFeedEvent(player.player, {
        type: "message",
        message: message.trim(),
    });

    return writs;
}

async function trade(
    buyer: PlayerEntity,
    seller: PlayerEntity,
    offer: Barter,
    receive: Barter,
    writ?: ItemEntity, // writ to destroy once fulfilled
) {
    const buyerIsHuman = isEntityHuman(buyer);
    const sellerIsHuman = isEntityHuman(seller);
    const [ok, cannotTradeMessage] = canTrade(buyer, seller, offer, receive);

    // Cannot trade - send `cannotLearnMessage` back to buyer
    if (!ok && buyerIsHuman) {
        await say(seller, cannotTradeMessage, {
            target: buyer.player,
            overwrite: true,
        });
    }

    // Get nearby players (near the buyer)
    const nearbyPlayerIds = await getNearbyPlayerIds(
        buyer.loc[0],
        buyer.locT as GeohashLocationType,
        buyer.locI,
    );

    // Publish action event
    publishActionEvent(nearbyPlayerIds, {
        action: "buy",
        source: buyer.player,
        target: seller.player,
    });

    // Transfer offer from buyer to seller
    for (const item of offer.items) {
        item.locT = "inv";
        item.loc[0] = seller.player;
        await saveEntity(item);
    }
    for (const [cur, amt] of Object.entries(offer.currency)) {
        buyer[cur as Currency] -= amt;
        seller[cur as Currency] += amt;
        await saveEntity(buyer);
        await saveEntity(seller);
    }

    // Transfer receive from seller to buyer
    for (const item of receive.items) {
        item.locT = "inv";
        item.loc[0] = buyer.player;
        await saveEntity(item);
    }
    for (const [cur, amt] of Object.entries(receive.currency)) {
        seller[cur as Currency] -= amt;
        buyer[cur as Currency] += amt;
        await saveEntity(buyer);
        await saveEntity(seller);
    }

    // Destroy writ if provided
    if (writ) {
        await itemRepository.remove(writ.item);
    }

    // Save player's state to MINIO
    await savePlayerState(buyer.player);
    await savePlayerState(seller.player);

    // Publish to nearby players
    publishAffectedEntitiesToPlayers(
        [buyer, seller, ...offer.items, ...receive.items],
        {
            publishTo: [buyer.player, seller.player],
            op: "upsert",
        },
    );

    // Send dialogues
    if (buyerIsHuman) {
        say(seller, barterDialogue(receive, seller, buyer), {
            target: buyer.player,
            overwrite: true,
        });
    }
    if (sellerIsHuman) {
        say(buyer, barterDialogue(offer, buyer, seller), {
            target: seller.player,
            overwrite: true,
        });
    }
}
