import { PUBLIC_HOST } from "$env/static/public";
import type { TransactionResult } from "$lib/anchorClient/types";
import type { PlayerMetadataSchema } from "$lib/server/crossover/router";
import { trpc } from "$lib/trpcClient";
import { retry, signAndSendTransaction } from "$lib/utils";
import { Transaction } from "@solana/web3.js";
import type { HTTPHeaders } from "@trpc/client";
import type { z } from "zod";
import { grid, player } from "../../store";

import { refresh } from "$lib/community";
import type {
    Item,
    Monster,
    Player,
} from "$lib/server/crossover/redis/entities";
import type { StreamEvent } from "../../routes/api/crossover/stream/+server";
import type { GameCommand } from "./ir";
import { updateGrid, type Direction } from "./world";
import type { Ability } from "./world/abilities";
import type { EquipmentSlot, ItemVariables, Utility } from "./world/compendium";

export {
    commandConfigureItem,
    commandCreateItem,
    commandDropItem,
    commandLook,
    commandMove,
    commandPerformAbility,
    commandSay,
    commandTakeItem,
    commandUseItem,
    equipItem,
    executeGameCommand,
    getPlayer,
    login,
    logout,
    playerInventory,
    signup,
    stream,
    unequipItem,
};

async function getPlayer(
    headers: HTTPHeaders = {},
): Promise<z.infer<typeof PlayerMetadataSchema>> {
    return await trpc({
        headers,
    }).crossover.auth.player.query();
}

async function signup(
    { name }: { name: string },
    options?: { headers?: HTTPHeaders; wallet?: any },
): Promise<TransactionResult> {
    return await trpc({
        headers: {
            "Content-Type": "application/json",
            ...(options?.headers || {}),
        },
    })
        .crossover.auth.signup.query({ name })
        .then(({ transaction }) => {
            return signAndSendTransaction({
                tx: Transaction.from(Buffer.from(transaction, "base64")),
                wallet: options?.wallet,
                commitment: "confirmed",
            });
        });
}

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
    player.set(response.player);

    return response;
}

async function logout(
    headers: HTTPHeaders = {},
): Promise<{ status: string; player: z.infer<typeof PlayerMetadataSchema> }> {
    let response = await trpc({
        headers,
    }).crossover.auth.logout.query();

    // Update `$player`
    player.set(null);

    return response;
}

/**
 * tRPC does not support SSE yet, so we use the api route directly
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
            .catch((error) => {
                console.error(error);
                eventTarget.dispatchEvent(
                    new CustomEvent("error", { detail: error }),
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
                    controller.enqueue({
                        type: "system",
                        data: { event: "error", message: err.message },
                    });
                }
            }
        },
    });
}

function makeWriteableEventStream(eventTarget: EventTarget) {
    return new WritableStream({
        write(message: StreamEvent, controller) {
            eventTarget.dispatchEvent(
                new MessageEvent(message.type, { data: message }),
            );
        },
    });
}

function commandSay(
    input: { message: string },
    headers: HTTPHeaders = {},
): Promise<void> {
    const { message } = input;
    return trpc({ headers }).crossover.cmd.say.query({ message });
}

async function commandLook(
    input: { target?: string },
    headers: HTTPHeaders = {},
) {
    const { target } = input;
    const result = await trpc({ headers }).crossover.cmd.look.query({ target });

    // Update `grid` with monsters, props, and players
    grid.update((g) => {
        return updateGrid({
            grid: g,
            monsters: result.monsters,
            players: result.players,
            items: result.items,
        });
    });

    return result;
}

function commandMove(
    input: { direction: Direction },
    headers: HTTPHeaders = {},
): Promise<string[]> {
    const { direction } = input;
    return trpc({ headers }).crossover.cmd.move.query({ direction });
}

function commandPerformAbility(
    input: { target: string; ability: string },
    headers: HTTPHeaders = {},
) {
    const { target, ability } = input;
    return trpc({ headers }).crossover.cmd.performAbility.query({
        target,
        ability,
    });
}

function commandUseItem(
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

function commandTakeItem(input: { item: string }, headers: HTTPHeaders = {}) {
    const { item } = input;
    return trpc({ headers }).crossover.cmd.take.query({ item });
}

function commandDropItem(input: { item: string }, headers: HTTPHeaders = {}) {
    const { item } = input;
    return trpc({ headers }).crossover.cmd.drop.query({ item });
}

function equipItem(
    input: { item: string; slot: EquipmentSlot },
    headers: HTTPHeaders = {},
) {
    const { item, slot } = input;
    return trpc({ headers }).crossover.player.equip.query({ item, slot });
}

function unequipItem(input: { item: string }, headers: HTTPHeaders = {}) {
    const { item } = input;
    return trpc({ headers }).crossover.player.unequip.query({ item });
}

function playerInventory(headers: HTTPHeaders = {}) {
    return trpc({ headers }).crossover.player.inventory.query();
}

function commandCreateItem(
    input: { geohash: string; prop: string; variables?: ItemVariables },
    headers: HTTPHeaders = {},
) {
    const { geohash, prop, variables } = input;
    return trpc({ headers }).crossover.cmd.createItem.query({
        prop,
        geohash,
        variables,
    });
}

function commandConfigureItem(
    input: { item: string; variables: ItemVariables },
    headers: HTTPHeaders = {},
) {
    const { item, variables } = input;
    return trpc({ headers }).crossover.cmd.configureItem.query({
        item,
        variables,
    });
}

async function executeGameCommand(
    gameCommand: GameCommand,
    headers: HTTPHeaders = {},
) {
    const [action, { self, target, item }] = gameCommand;

    // Use Item
    if (item != null) {
        return await commandUseItem(
            {
                target:
                    (target as Player)?.player ||
                    (target as Monster)?.monster ||
                    (target as Item)?.item ||
                    undefined,
                item: item.item,
                utility: (action as Utility).utility,
            },
            headers,
        );
    }
    // Perform ability
    else {
        return await commandPerformAbility(
            {
                target:
                    (target as Player)?.player ||
                    (target as Monster)?.monster ||
                    (target as Item)?.item,
                ability: (action as Ability).ability,
            },
            headers,
        );
    }
}
