import { PUBLIC_HOST } from "$env/static/public";
import type { TransactionResult } from "$lib/anchorClient/types";
import { refresh } from "$lib/community";
import { getDirectionsToPosition } from "$lib/components/crossover/Game/utils";
import type {
    Item,
    Monster,
    Player,
} from "$lib/server/crossover/redis/entities";
import { trpc } from "$lib/trpcClient";
import { retry, signAndSendTransaction, sleep } from "$lib/utils";
import { Transaction } from "@solana/web3.js";
import type { HTTPHeaders } from "@trpc/client";
import { get } from "svelte/store";
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
import type { GameCommand, GameCommandVariables } from "./ir";
import { geohashToColRow, getEntityId } from "./utils";
import type { Ability } from "./world/abilities";
import { actions, type Action } from "./world/actions";
import {
    EquipmentSlots,
    compendium,
    type EquipmentSlot,
    type ItemVariables,
    type Utility,
} from "./world/compendium";
import type { PlayerMetadata } from "./world/player";
import { MS_PER_TICK, SERVER_LATENCY } from "./world/settings";
import { Directions, type Direction } from "./world/types";
import { worldSeed } from "./world/world";

export {
    addMessageFeed,
    crossoverAuthPlayer,
    crossoverAvailableAvatars,
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
    crossoverGenerateAvatar,
    crossoverPlayerInventory,
    crossoverPlayerMetadata,
    crossoverWorldWorlds,
    executeGameCommand,
    handleUpdateEntities,
    login,
    logout,
    signup,
    stream,
    updateWorlds,
    type MessageFeed,
};

type MessageFeedType = "error" | "message" | "system";

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

async function updateWorlds(geohash: string) {
    const t = geohash.slice(0, worldSeed.spatial.town.precision);
    if (get(worldRecord)[t] != null) {
        return;
    }
    const { town, worlds } = await crossoverWorldWorlds(geohash);
    worldRecord.update((wr) => {
        if (wr[town] == null) {
            wr[town] = {}; // no world in town ({} is valid)
        }
        for (const w of worlds) {
            wr[town][w.world] = w;
        }
        return wr;
    });
}

async function handleUpdatePlayer(before: Player, after: Player) {
    // Location changed
    if (before.loc[0] !== after.loc[0]) {
        await updateWorlds(after.loc[0]);
    }
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
                    handleUpdatePlayer(self, p);
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

async function moveInRangeOfTarget({
    range,
    target,
}: {
    range: number;
    target: Player | Monster | Item;
}) {
    const targetGeohash = target.loc[0]; // TODO: consider entities with loc more than 1 cell
    const sourceGeohash = get(player)?.loc[0];

    if (sourceGeohash == null) {
        throw new Error("Player location is unknown");
    }

    const [targetCol, targetRow] = geohashToColRow(targetGeohash);
    const [sourceCol, sourceRow] = geohashToColRow(sourceGeohash);
    const path = getDirectionsToPosition(
        {
            row: sourceRow,
            col: sourceCol,
        },
        {
            row: targetRow,
            col: targetCol,
        },
        range,
    );

    await crossoverCmdMove({ path });

    // Wait for player to move the path
    await sleep(
        SERVER_LATENCY + path.length * actions.move.ticks * MS_PER_TICK,
    );
}

async function executeGameCommand(
    command: GameCommand,
    headers: HTTPHeaders = {},
): Promise<void> {
    const [action, { self, target, item }, variables] = command;

    try {
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
            const ability = action as Ability;

            // Move in range of target
            await moveInRangeOfTarget({
                range: ability.range,
                target: target as Player | Monster | Item,
            });

            return await crossoverCmdPerformAbility(
                {
                    target:
                        (target as Player)?.player ||
                        (target as Monster)?.monster ||
                        (target as Item)?.item,
                    ability: ability.ability,
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
    } catch (error: any) {
        addMessageFeed({
            message: error.message,
            name: "Error",
            messageFeedType: "error",
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
): Promise<void> {
    // look
    if (action.action === "look") {
        return await crossoverCmdLook(
            { target: target ? getEntityId(target)[0] : undefined },
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
            return await crossoverCmdMove({ path: [direction] }, headers);
        }
        throw new Error(`Invalid direction ${direction}`);
    }
    // take
    else if (action.action === "take") {
        return await crossoverCmdTake(
            { item: getEntityId(target as Item)[0] },
            headers,
        );
    }
    // drop
    else if (action.action === "drop") {
        return await crossoverCmdDrop(
            { item: getEntityId(target as Item)[0] },
            headers,
        );
    }
    // equip
    else if (action.action === "equip" && variables != null) {
        const slot = variables.queryIrrelevant as EquipmentSlot;
        if (EquipmentSlots.includes(slot)) {
            return await crossoverCmdEquip(
                {
                    item: getEntityId(target as Item)[0],
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
            { item: getEntityId(target as Item)[0] },
            headers,
        );
    }
    // create
    else if (action.action === "create" && variables != null) {
        const prop = variables.queryIrrelevant as string;
        const geohash = self.loc[0];
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
            { item: getEntityId(target as Item)[0], variables: { [key]: val } },
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
    input: { message: string },
    headers: HTTPHeaders = {},
) {
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
    input: { path: Direction[] },
    headers: HTTPHeaders = {},
) {
    const { path } = input;
    return trpc({ headers }).crossover.cmd.move.query({ path });
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

function crossoverPlayerMetadata(headers: HTTPHeaders = {}) {
    return trpc({ headers }).crossover.player.metadata.query();
}

/*
 * crossover.world
 */

function crossoverWorldWorlds(geohash: string, headers: HTTPHeaders = {}) {
    return trpc({ headers }).crossover.world.worlds.query({ geohash });
}

/*
 * Character creation
 */

async function crossoverAvailableAvatars(
    playerMetadata: PlayerMetadata,
    headers: any = {},
): Promise<string[]> {
    const { avatars } = await (
        await fetch(`${PUBLIC_HOST}/api/crossover/avatar/avatars`, {
            method: "POST",
            headers,
            body: JSON.stringify(playerMetadata),
        })
    ).json();
    return avatars;
}

async function crossoverGenerateAvatar(
    playerMetadata: PlayerMetadata,
    headers: any = {},
): Promise<[string, string]> {
    const { avatarImageUrl } = await (
        await fetch(`${PUBLIC_HOST}/api/crossover/avatar/create`, {
            method: "POST",
            headers,
            body: JSON.stringify(playerMetadata),
        })
    ).json();

    return [avatarImageUrl, avatarImageUrl];
}
