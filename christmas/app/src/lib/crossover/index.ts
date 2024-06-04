import { PUBLIC_HOST } from "$env/static/public";
import type { TransactionResult } from "$lib/anchorClient/types";
import { refresh } from "$lib/community";
import type {
    Item,
    Monster,
    Player,
} from "$lib/server/crossover/redis/entities";
import { trpc } from "$lib/trpcClient";
import { retry, signAndSendTransaction } from "$lib/utils";
import { Transaction } from "@solana/web3.js";
import type { HTTPHeaders } from "@trpc/client";
import { get } from "svelte/store";
import type { z } from "zod";
import type {
    FeedEvent,
    StreamEvent,
} from "../../routes/api/crossover/stream/+server";
import {
    itemRecord,
    messageFeed,
    monsterRecord,
    player,
    playerRecord,
    worldRecord,
} from "../../store";
import { actions, type Action } from "./actions";
import type { GameCommand, GameCommandVariables } from "./ir";
import { entityId } from "./utils";
import { Directions, type Direction } from "./world";
import type { Ability } from "./world/abilities";
import {
    EquipmentSlots,
    type EquipmentSlot,
    type ItemVariables,
    type Utility,
} from "./world/compendium";
import type { PlayerMetadataSchema } from "./world/player";
import { compendium, worldSeed } from "./world/settings";

export {
    addMessageFeed,
    crossoverAuthPlayer,
    crossoverCmdConfigureItem,
    crossoverCmdCreateItem,
    crossoverCmdDrop,
    crossoverCmdEquip,
    crossoverCmdLook,
    crossoverCmdMove,
    crossoverCmdPerformAbility,
    crossoverCmdRest,
    crossoverCmdSay,
    crossoverCmdTake,
    crossoverCmdUnequip,
    crossoverCmdUseItem,
    crossoverPlayerInventory,
    crossoverWorldWorlds,
    executeGameCommand,
    handleGC,
    handleUpdateEntities,
    login,
    logout,
    signup,
    stream,
    type GameCommandResponse,
    type MessageFeed,
};

interface GameCommandResponse {
    status: "success" | "failure";
    op?: "upsert" | "replace";
    message?: string;
    players?: Player[];
    monsters?: Monster[];
    items?: Item[];
}

type MessageFeedType = "error" | "message" | "look" | "system";

interface MessageFeed {
    id: number;
    name: string;
    timestamp: Date;
    message: string;
    messageFeedType: MessageFeedType;
}

function displayEntityEffects<T extends Player | Monster | Item>(
    oldEntity: T,
    newEntity: T,
) {
    if ("monster" in oldEntity) {
        // Handle monster entity
        const deltaHp = oldEntity.hp - (newEntity as Monster).hp;
        if (deltaHp > 0) {
            addMessageFeed({
                message: `${oldEntity.monster} lost ${deltaHp} HP`,
                name: "",
                messageFeedType: "message",
            });
        }
    } else if ("player" in oldEntity) {
        // Handle player entity
        const deltaHp = oldEntity.hp - (newEntity as Player).hp;
        if (deltaHp > 0) {
            addMessageFeed({
                message: `${oldEntity.player} lost ${deltaHp} HP`,
                name: "",
                messageFeedType: "message",
            });
        }
    } else if ("item" in oldEntity) {
        // Handle item entity
    }
}

function addMessageFeed({
    message,
    name,
    messageFeedType,
}: {
    message: string;
    name: string;
    messageFeedType: MessageFeedType;
}) {
    messageFeed.update((ms) => {
        return [
            ...ms,
            {
                id: ms.length,
                timestamp: new Date(),
                message,
                name,
                messageFeedType,
            },
        ];
    });
}

async function handleGC(command: GameCommand) {
    try {
        const gcResponse = await executeGameCommand(command);
        if (gcResponse != null) {
            await processGCResponse(command, gcResponse);
        }
    } catch (error: any) {
        console.error(error);
        addMessageFeed({
            message: error.message,
            name: "Error",
            messageFeedType: "error",
        });
    }
}

async function handleUpdateWorlds(geohash: string) {
    // Check if worldRecord already has the town (no worlds or {} is valid)
    if (
        get(worldRecord)[geohash.slice(0, worldSeed.spatial.town.precision)] !=
        null
    ) {
        return;
    }

    const { town, worlds } = await crossoverWorldWorlds(geohash);
    worldRecord.update((wr) => {
        if (wr[town] == null) {
            wr[town] = {}; // no world in town
        }
        for (const w of worlds) {
            wr[town][w.world] = w;
        }
        return wr;
    });
}

function handleUpdateEntities(
    {
        players,
        items,
        monsters,
    }: {
        players?: Player[];
        items?: Item[];
        monsters?: Monster[];
    },
    op?: "upsert" | "replace",
) {
    const self = get(player);
    op ??= "upsert";

    // Update playerRecord
    if (players != null) {
        playerRecord.update((pr) => {
            if (op === "replace") {
                pr = {};
            }
            for (const p of players) {
                // Update self (player)
                if (p.player === self?.player) {
                    player.set(p);
                } else {
                    pr[p.player] = p;
                }
            }
            return pr;
        });
    }

    // Update itemRecord
    if (items != null) {
        itemRecord.update((ir) => {
            if (op === "replace") {
                ir = {};
            }
            for (const i of items) {
                ir[i.item] = i;
            }
            return ir;
        });
    }

    // Update monsterRecord
    if (monsters != null) {
        monsterRecord.update((mr) => {
            if (op === "replace") {
                mr = {};
            }
            for (const m of monsters) {
                if (mr[m.monster]) {
                    displayEntityEffects(mr[m.monster], m);
                }
                mr[m.monster] = m;
            }
            return mr;
        });
    }
}

async function processGCResponse(
    command: GameCommand,
    response: GameCommandResponse,
) {
    const { players, monsters, items, op, status, message } = response;
    const self = get(player);

    // Update message feed
    if (status === "failure" && message != null) {
        addMessageFeed({ message, name: "Error", messageFeedType: "error" });
    }

    // Update entities
    handleUpdateEntities({ players, items, monsters }, op);

    // Perform secondary effects
    const [action, entities, variables] = command;
    if (self?.player != null && "action" in action) {
        // Update inventory on equip, unequip, take, drop
        if (
            [
                actions.equip.action,
                actions.unequip.action,
                actions.take.action,
                actions.drop.action,
            ].includes(action.action)
        ) {
            await handleGC([actions.inventory, { self }]);
        }
        // Look at surroundings on take, drop, create
        if (
            [
                actions.take.action,
                actions.drop.action,
                actions.create.action,
            ].includes(action.action)
        ) {
            await handleGC([actions.look, { self }]);
        }
        // Add look to message feed
        if (action.action === actions.look.action) {
            addMessageFeed({
                message: "",
                name: "",
                messageFeedType: "look",
            });
        }
        // Update worlds on move into new town
        if (
            action.action === actions.move.action ||
            action.action === actions.look.action
        ) {
            await handleUpdateWorlds(self.location[0]);
        }
    }
}

async function executeGameCommand(
    command: GameCommand,
    headers: HTTPHeaders = {},
): Promise<GameCommandResponse | void> {
    const [action, { self, target, item }, variables] = command;

    // Use Item
    if (item != null) {
        return await crossoverCmdUseItem(
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
    else if ("ability" in action) {
        return await crossoverCmdPerformAbility(
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
    // Action (variables are required)
    else if ("action" in action) {
        return await performAction({
            self,
            action,
            target,
            variables,
        });
    }
}

async function performAction(
    {
        self,
        action,
        target,
        variables,
    }: {
        action: Action;
        self: Player | Monster;
        target?: Player | Monster | Item;
        variables?: GameCommandVariables;
    },
    headers: HTTPHeaders = {},
): Promise<GameCommandResponse | void> {
    // look
    if (action.action === "look") {
        return await crossoverCmdLook(
            { target: target ? entityId(target)[0] : undefined },
            headers,
        );
    }
    // say
    else if (action.action === "say" && variables != null) {
        return await crossoverCmdSay(
            { message: variables.queryIrrelevant },
            headers,
        );
    }
    // move
    else if (action.action === "move" && variables != null) {
        const direction = variables.queryIrrelevant as Direction;
        if (Directions.includes(direction)) {
            return await crossoverCmdMove({ direction }, headers);
        }
        throw new Error(`Invalid direction ${direction}`);
    }
    // take
    else if (action.action === "take") {
        return await crossoverCmdTake(
            { item: entityId(target as Item)[0] },
            headers,
        );
    }
    // drop
    else if (action.action === "drop") {
        return await crossoverCmdDrop(
            { item: entityId(target as Item)[0] },
            headers,
        );
    }
    // equip
    else if (action.action === "equip" && variables != null) {
        const slot = variables.queryIrrelevant as EquipmentSlot;
        if (EquipmentSlots.includes(slot)) {
            return await crossoverCmdEquip(
                {
                    item: entityId(target as Item)[0],
                    slot,
                },
                headers,
            );
        }
        throw new Error(`Invalid slot ${slot}`);
    }
    // unequip
    else if (action.action === "unequip") {
        return await crossoverCmdUnequip(
            { item: entityId(target as Item)[0] },
            headers,
        );
    }
    // create
    else if (action.action === "create" && variables != null) {
        const prop = variables.queryIrrelevant as string;
        const geohash = self.location[0];
        if (Object.keys(compendium).includes(prop)) {
            return await crossoverCmdCreateItem(
                {
                    geohash,
                    prop: prop,
                },
                headers,
            );
        }
        throw new Error(`Invalid prop ${prop}`);
    }
    // configure
    else if (action.action === "configure" && variables != null) {
        const [key, val] = variables.queryIrrelevant.split(":");
        return await crossoverCmdConfigureItem(
            { item: entityId(target as Item)[0], variables: { [key]: val } },
            headers,
        );
    }
    // inventory
    else if (action.action === "inventory") {
        return await crossoverPlayerInventory(headers);
    }
    // rest
    else if (action.action === "rest") {
        return await crossoverCmdRest(headers);
    }

    throw new Error(`Unknown action ${action}`);
}

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
    player.set(response.player);

    return response;
}

async function logout(
    headers: HTTPHeaders = {},
): Promise<{ status: string; player: Player }> {
    let response = await trpc({
        headers,
    }).crossover.auth.logout.query();

    // Update `$player`
    player.set(null);

    return response;
}

async function crossoverAuthPlayer(headers: HTTPHeaders = {}): Promise<Player> {
    return await trpc({
        headers,
    }).crossover.auth.player.query();
}

async function signup(
    playerMetadata: z.infer<typeof PlayerMetadataSchema>,
    options?: { headers?: HTTPHeaders; wallet?: any },
): Promise<TransactionResult> {
    return await trpc({
        headers: {
            "Content-Type": "application/json",
            ...(options?.headers || {}),
        },
    })
        .crossover.auth.signup.query(playerMetadata)
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
    input: { message: string },
    headers: HTTPHeaders = {},
): Promise<GameCommandResponse> {
    const { message } = input;
    return trpc({ headers }).crossover.cmd.say.query({ message });
}

async function crossoverCmdLook(
    input: { target?: string },
    headers: HTTPHeaders = {},
) {
    const { target } = input;
    return await trpc({ headers }).crossover.cmd.look.query({ target });
}

function crossoverCmdMove(
    input: { direction: Direction },
    headers: HTTPHeaders = {},
) {
    const { direction } = input;
    return trpc({ headers }).crossover.cmd.move.query({ direction });
}

function crossoverCmdPerformAbility(
    input: { target: string; ability: string },
    headers: HTTPHeaders = {},
) {
    const { target, ability } = input;
    return trpc({ headers }).crossover.cmd.performAbility.query({
        target,
        ability,
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
    return trpc({ headers }).crossover.player.equip.query({ item, slot });
}

function crossoverCmdUnequip(
    input: { item: string },
    headers: HTTPHeaders = {},
) {
    const { item } = input;
    return trpc({ headers }).crossover.player.unequip.query({ item });
}

function crossoverCmdCreateItem(
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

function crossoverCmdRest(headers: HTTPHeaders = {}) {
    return trpc({ headers }).crossover.cmd.rest.query();
}

/*
 * crossover.player
 */

function crossoverPlayerInventory(headers: HTTPHeaders = {}) {
    return trpc({ headers }).crossover.player.inventory.query();
}

/*
 * crossover.world
 */

function crossoverWorldWorlds(geohash: string, headers: HTTPHeaders = {}) {
    return trpc({ headers }).crossover.world.worlds.query({ geohash });
}
