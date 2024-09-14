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

async function createTradeWrit(
    player: PlayerEntity, // the player creating the writ
    order: "buy" | "sell",
    offer: Barter, // offer & receive is always w.r.t to the player
    receive: Barter,
): Promise<ItemEntity> {
    const buyer = order === "buy" ? player : null;
    const seller = order === "sell" ? player : null;
    const offerDesc = barterDescription(offer);
    const receiveDesc = barterDescription(receive);
    const expiresIn = 60;

    const tradeTx: P2PTradeTransaction = {
        action: "trade",
        message: `${player.name} is offering to ${order} ${offerDesc} for ${receiveDesc}.`,
        seller: seller?.player ?? "",
        buyer: buyer?.player ?? "",
        offer: serializeBarter(offer),
        receive: serializeBarter(receive),
    };

    const writ = await spawnItemInInventory({
        entity: player,
        prop: compendium.tradewrit.prop,
        variables: {
            token: await createP2PTransaction(tradeTx, expiresIn), // TODO: show expiry dynamically, allow set expiry
        },
    });

    return writ;
}

async function createTradeCTA(
    buyer: PlayerEntity,
    seller: PlayerEntity,
    offer: Barter,
    receive: Barter,
): Promise<CTA> {
    // Seller must be a human player
    if (isEntityHuman(seller)) {
        const expiresIn = 60; // for CTA, hardcode to 60 seconds
        const pin = generatePin(4);
        const offerDesc = barterDescription(offer);
        const receiveDesc = barterDescription(receive);
        const message = `${buyer.name} is offering to buy ${offerDesc} for ${receiveDesc}.`;
        const tradeTx: P2PTradeTransaction = {
            action: "trade",
            message: message,
            seller: seller.player,
            buyer: buyer.player,
            offer: serializeBarter(offer),
            receive: serializeBarter(receive),
        };
        return {
            cta: "writ",
            name: "Trade Writ",
            description: `${message} You have ${expiresIn}s to *accept ${pin}*.`,
            token: await createP2PTransaction(tradeTx, expiresIn),
            pin,
        };
    }

    throw new Error("Seller is not a player");
}

async function executeTradeCTA(
    executor: PlayerEntity,
    p2pTradeTx: P2PTradeTransaction,
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
    if (executor.player !== seller && executor.player !== buyer) {
        publishFeedEvent(executor.player, {
            type: "error",
            message: `You try to execute the agreement, but it rejects you with a slight jolt.`,
        });
    }

    // Need to check before executing so we can send any dialogues to the executor only
    const [canTrade, cannotTradeMessage] = canTradeWith(
        buyerEntity,
        sellerEntity,
        barterOffer,
        barterReceive,
    );
    if (!canTrade) {
        if (isEntityHuman(executor)) {
            say(buyerEntity, cannotTradeMessage, {
                target: executor.player,
                overwrite: true,
            });
        }
        return; // stop the execution
    }

    await trade(buyerEntity, sellerEntity, barterOffer, barterReceive);
}

async function trade(
    buyer: PlayerEntity,
    seller: PlayerEntity,
    offer: Barter,
    receive: Barter,
) {
    const buyerIsHuman = isEntityHuman(buyer);
    const sellerIsHuman = isEntityHuman(seller);

    const [canTrade, cannotTradeMessage] = canTradeWith(
        buyer,
        seller,
        offer,
        receive,
    );

    // Cannot trade - send `cannotLearnMessage` back to buyer
    if (!canTrade && buyerIsHuman) {
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
        action: "trade",
        source: seller.player,
        target: buyer.player,
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
