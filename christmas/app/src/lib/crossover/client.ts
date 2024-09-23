import { PUBLIC_HOST } from "$env/static/public";
import type { TransactionResult } from "$lib/anchorClient/types";
import { refresh } from "$lib/community";
import type { Player } from "$lib/crossover/types";
import { trpc } from "$lib/trpcClient";
import { retry, signAndSendTransaction } from "$lib/utils";
import { Transaction } from "@solana/web3.js";
import type { HTTPHeaders } from "@trpc/client";
import type {
    FeedEvent,
    StreamEvent,
} from "../../routes/api/crossover/stream/+server";
import { player } from "../../store";
import type { Abilities } from "./world/abilities";
import { type ItemVariables } from "./world/compendium";
import type {
    PlayerAppearance,
    PlayerDemographic,
    PlayerMetadata,
} from "./world/player";
import type { SkillLines } from "./world/skills";
import {
    type BarterSerialized,
    type Direction,
    type EquipmentSlot,
    type GeohashLocationType,
} from "./world/types";

export {
    crossoverAuthPlayer,
    crossoverAvailableAvatars,
    crossoverCmdAccept,
    crossoverCmdAttack,
    crossoverCmdBrowse,
    crossoverCmdConfigureItem,
    crossoverCmdCreateItem,
    crossoverCmdDrop,
    crossoverCmdEnterItem,
    crossoverCmdEquip,
    crossoverCmdFulfill,
    crossoverCmdGive,
    crossoverCmdLearn,
    crossoverCmdLook,
    crossoverCmdMove,
    crossoverCmdPerformAbility,
    crossoverCmdRest,
    crossoverCmdSay,
    crossoverCmdTake,
    crossoverCmdTrade,
    crossoverCmdUnequip,
    crossoverCmdUseItem,
    crossoverCmdWrit,
    crossoverGenerateAvatar,
    crossoverPlayerInventory,
    crossoverPlayerMetadata,
    crossoverWorldPOI,
    crossoverWorldWorlds,
    login,
    logout,
    signup,
    stream,
};

/*
 * api.crossover (tRPC does not support SSE yet, so we use the api route directly)
 */

async function stream(headers: any = {}): Promise<[EventTarget, () => void]> {
    const eventTarget = new EventTarget();
    const eventStream = makeWriteableEventStream(eventTarget);
    const abortController = new AbortController();

    fetch(`${PUBLIC_HOST}/api/crossover/stream`, {
        method: "GET",
        headers,
        signal: abortController.signal,
    }).then(async (response) => {
        if (!response.ok) {
            throw new Error(await response.text());
        }
        if (response.body == null) {
            throw new Error("Missing body in stream response");
        }
        return response.body
            .pipeThrough(new TextDecoderStream())
            .pipeThrough(makeJsonDecoder())
            .pipeTo(eventStream)
            .catch((err: any) => {
                console.error(err);
                const feedEvent: FeedEvent = {
                    event: "feed",
                    type: "error",
                    message: err.message,
                };
                eventTarget.dispatchEvent(
                    new MessageEvent(feedEvent.event, { data: feedEvent }),
                );
            });
    });

    async function close() {
        console.log("User closed stream");
        abortController.abort();
    }

    return [eventTarget, close];
}

function makeJsonDecoder(): TransformStream<any, any> {
    return new TransformStream({
        transform(
            chunk: string,
            controller: TransformStreamDefaultController<any>,
        ) {
            for (let s of chunk.split(/\n\n/)) {
                try {
                    s = s.trim();
                    if (s.length > 0) {
                        controller.enqueue(JSON.parse(s));
                    }
                } catch (err: any) {
                    const feedEvent: FeedEvent = {
                        event: "feed",
                        type: "error",
                        message: err.message,
                    };
                    controller.enqueue(feedEvent);
                }
            }
        },
    });
}

function makeWriteableEventStream(eventTarget: EventTarget) {
    return new WritableStream({
        write(event: StreamEvent, controller) {
            eventTarget.dispatchEvent(
                new MessageEvent(event.event, { data: event }),
            );
        },
    });
}

/*
 * crossover.auth
 */

async function login(
    {
        region,
        geohash,
        retryWithRefresh,
    }: {
        region: string | number[];
        geohash: string | number[];
        retryWithRefresh?: boolean;
    },
    headers: HTTPHeaders = {},
): Promise<{ status: string; player: Player }> {
    retryWithRefresh ??= false;
    region =
        typeof region === "string" ? region : String.fromCharCode(...region);
    geohash =
        typeof geohash === "string" ? geohash : String.fromCharCode(...geohash);

    let response;
    if (!retryWithRefresh) {
        response = await trpc({
            headers,
        }).crossover.auth.login.query({
            region: region as string,
            geohash: geohash as string,
        });
    } else {
        // Try to login, and if it fails, refresh the session and try again
        response = await retry({
            fn: async () => {
                return await trpc({
                    headers,
                }).crossover.auth.login.query({
                    region: region as string,
                    geohash: geohash as string,
                });
            },
            remedyFn: async () => {
                await refresh(headers);
            },
        });
    }

    // Update `$player`
    player.set(response.player); // TODO: Side effects here is hard to understand

    return response;
}

async function logout(
    headers: HTTPHeaders = {},
): Promise<{ status: string; player: Player }> {
    let response = await trpc({
        headers,
    }).crossover.auth.logout.query();

    // Update `$player`
    player.set(null); // TODO: Side effects here is hard to understand

    return response;
}

async function crossoverAuthPlayer(headers: HTTPHeaders = {}): Promise<Player> {
    return await trpc({
        headers,
    }).crossover.auth.player.query();
}

async function signup(
    playerMetadata: PlayerMetadata,
    options?: { headers?: HTTPHeaders; wallet?: any },
): Promise<TransactionResult> {
    return await trpc({
        headers: {
            "Content-Type": "application/json",
            ...(options?.headers || {}),
        },
    })
        .crossover.auth.signup.mutate(playerMetadata)
        .then(({ transaction }) => {
            return signAndSendTransaction({
                tx: Transaction.from(Buffer.from(transaction, "base64")),
                wallet: options?.wallet,
                commitment: "confirmed",
            });
        });
}

/*
 * crossover.cmd
 */

function crossoverCmdSay(
    input: { message: string; target?: string },
    headers: HTTPHeaders = {},
) {
    const { message, target } = input;
    return trpc({ headers }).crossover.cmd.say.query({ message, target });
}

function crossoverCmdLearn(
    input: { skill: SkillLines; teacher: string },
    headers: HTTPHeaders = {},
) {
    const { skill, teacher } = input;
    return trpc({ headers }).crossover.cmd.learn.query({ skill, teacher });
}

function crossoverCmdGive(
    input: { item: string; receiver: string },
    headers: HTTPHeaders = {},
) {
    const { item, receiver } = input;
    return trpc({ headers }).crossover.cmd.give.query({ item, receiver });
}

function crossoverCmdBrowse(
    input: {
        player: string;
    },
    headers: HTTPHeaders = {},
) {
    const { player } = input;
    return trpc({ headers }).crossover.cmd.browse.query({
        player,
    });
}

function crossoverCmdFulfill(
    input: {
        item: string;
    },
    headers: HTTPHeaders = {},
) {
    const { item } = input;
    return trpc({ headers }).crossover.cmd.fulfill.query({
        item,
    });
}

function crossoverCmdTrade(
    input: {
        offer: BarterSerialized;
        receive: BarterSerialized;
        seller: string;
        buyer: string;
    },
    headers: HTTPHeaders = {},
) {
    const { offer, receive, seller, buyer } = input;
    return trpc({ headers }).crossover.cmd.trade.query({
        offer,
        receive,
        seller,
        buyer,
    });
}

function crossoverCmdWrit(
    input: {
        offer: BarterSerialized;
        receive: BarterSerialized;
        seller: string;
        buyer: string;
    },
    headers: HTTPHeaders = {},
) {
    const { offer, receive, seller, buyer } = input;
    return trpc({ headers }).crossover.cmd.writ.query({
        offer,
        receive,
        seller,
        buyer,
    });
}

function crossoverCmdAccept(
    input: { token: string },
    headers: HTTPHeaders = {},
) {
    const { token } = input;
    return trpc({ headers }).crossover.cmd.accept.query({ token });
}

async function crossoverCmdLook(
    input: { target?: string },
    headers: HTTPHeaders = {},
) {
    const { target } = input;
    return await trpc({ headers }).crossover.cmd.look.query({ target });
}

function crossoverCmdMove(
    input: { path: Direction[] },
    headers: HTTPHeaders = {},
) {
    const { path } = input;
    return trpc({ headers }).crossover.cmd.move.query({ path });
}

function crossoverCmdPerformAbility(
    input: { target: string; ability: Abilities },
    headers: HTTPHeaders = {},
) {
    const { target, ability } = input;
    return trpc({ headers }).crossover.cmd.performAbility.query({
        target,
        ability,
    });
}

function crossoverCmdAttack(
    input: { target: string },
    headers: HTTPHeaders = {},
) {
    const { target } = input;
    return trpc({ headers }).crossover.cmd.attack.query({
        target,
    });
}

function crossoverCmdUseItem(
    input: { target?: string; item: string; utility: string },
    headers: HTTPHeaders = {},
) {
    const { target, item, utility } = input;
    return trpc({ headers }).crossover.cmd.useItem.query({
        target,
        item,
        utility,
    });
}

function crossoverCmdTake(input: { item: string }, headers: HTTPHeaders = {}) {
    const { item } = input;
    return trpc({ headers }).crossover.cmd.take.query({ item });
}

function crossoverCmdDrop(input: { item: string }, headers: HTTPHeaders = {}) {
    const { item } = input;
    return trpc({ headers }).crossover.cmd.drop.query({ item });
}

function crossoverCmdEquip(
    input: { item: string; slot: EquipmentSlot },
    headers: HTTPHeaders = {},
) {
    const { item, slot } = input;
    return trpc({ headers }).crossover.cmd.equip.query({ item, slot });
}

function crossoverCmdUnequip(
    input: { item: string },
    headers: HTTPHeaders = {},
) {
    const { item } = input;
    return trpc({ headers }).crossover.cmd.unequip.query({ item });
}

function crossoverCmdCreateItem(
    input: {
        prop: string;
        variables?: ItemVariables;
    },
    headers: HTTPHeaders = {},
) {
    const { prop, variables } = input;
    return trpc({ headers }).crossover.cmd.createItem.query({
        prop,
        variables,
    });
}

function crossoverCmdConfigureItem(
    input: { item: string; variables: ItemVariables },
    headers: HTTPHeaders = {},
) {
    const { item, variables } = input;
    return trpc({ headers }).crossover.cmd.configureItem.query({
        item,
        variables,
    });
}

function crossoverCmdEnterItem(
    input: { item: string },
    headers: HTTPHeaders = {},
) {
    const { item } = input;
    return trpc({ headers }).crossover.cmd.enterItem.query({
        item,
    });
}

function crossoverCmdRest(headers: HTTPHeaders = {}) {
    return trpc({ headers }).crossover.cmd.rest.query();
}

/*
 * crossover.player
 */

function crossoverPlayerInventory(headers: HTTPHeaders = {}) {
    return trpc({ headers }).crossover.player.inventory.query();
}

function crossoverPlayerMetadata(headers: HTTPHeaders = {}) {
    return trpc({ headers }).crossover.player.metadata.query();
}

/*
 * crossover.world
 */

function crossoverWorldWorlds(
    geohash: string,
    locationType: GeohashLocationType,
    headers: HTTPHeaders = {},
) {
    return trpc({ headers }).crossover.world.worlds.query({
        geohash,
        locationType,
    });
}

function crossoverWorldPOI(headers: HTTPHeaders = {}) {
    return trpc({ headers }).crossover.world.poi.query();
}

/*
 * Character creation
 */

async function crossoverAvailableAvatars(
    metadata: {
        demographic: PlayerDemographic;
        appearance: PlayerAppearance;
    },
    headers: any = {},
): Promise<string[]> {
    const { avatars } = await (
        await fetch(`${PUBLIC_HOST}/api/crossover/avatar/avatars`, {
            method: "POST",
            headers,
            body: JSON.stringify(metadata),
        })
    ).json();
    return avatars;
}

async function crossoverGenerateAvatar(
    metadata: {
        demographic: PlayerDemographic;
        appearance: PlayerAppearance;
    },
    headers: any = {},
): Promise<string[]> {
    const response = await fetch(`${PUBLIC_HOST}/api/crossover/avatar/create`, {
        method: "POST",
        headers,
        body: JSON.stringify(metadata),
    });
    if (!response.ok) {
        throw new Error("Generation service is down");
    }
    return await response.json();
}
