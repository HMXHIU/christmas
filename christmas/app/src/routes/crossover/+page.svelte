<script lang="ts">
    import GameWindow from "$lib/components/crossover/GameWindow.svelte";
    import Onboard from "$lib/components/crossover/Onboard.svelte";
    import {
        commandLook,
        commandMove,
        commandPerformAbility,
        commandUseItem,
        stream,
    } from "$lib/crossover";

    import type { MessageFeedUI } from "$lib/components/common/types";

    import type { GameCommand } from "$lib/crossover/ir";
    import {
        abyssTile,
        loadMoreGrid,
        type Direction,
    } from "$lib/crossover/world";
    import type {
        Item,
        Monster,
        Player,
    } from "$lib/server/crossover/redis/entities";
    import type { TileSchema } from "$lib/server/crossover/router";
    import { substituteVariables } from "$lib/utils";
    import { onMount } from "svelte";
    import type { z } from "zod";
    import { grid, player } from "../../store";
    import type { FeedEvent } from "../api/crossover/stream/+server";

    let messageFeed: MessageFeedUI[] = [];
    let eventStream: EventTarget | null = null;
    let closeStream: (() => void) | null = null;
    let tile: z.infer<typeof TileSchema> = abyssTile;
    let players: Player[] = [];
    let items: Item[] = [];
    let monsters: Monster[] = [];

    async function onGameCommand(gameCommand: GameCommand) {
        const [command, { self, target }] = gameCommand;
        if ("utility" in command) {
            commandUseItem({
                target:
                    (target as any).player ||
                    (target as any).monster ||
                    (target as any).item,
                item: "", // HOW TO GET ITEM
                utility: command.utility,
            });
        } else if ("ability" in command) {
            commandPerformAbility({
                target:
                    (target as any).player ||
                    (target as any).monster ||
                    (target as any).item,
                ability: command.ability,
            });
        }
    }

    // TODO: convert these to special commands
    //
    // async function onChatMessage(
    //     command: ChatCommandUI | null,
    //     message: string,
    // ) {
    //     switch (command?.key) {
    //         case "say":
    //             await commandSay({ message });
    //             break;

    //         case "look":
    //             await look();
    //             break;

    //         case "spawnItem":
    //             // Test spawn wooden door
    //             const item = await commandCreateItem({
    //                 geohash: tile.geohash,
    //                 prop: compendium.woodenDoor.prop,
    //             });
    //             console.log(JSON.stringify(item, null, 2));
    //             break;

    //         case "useItem":
    //             // Test use wooden door
    //             const usedItem = await commandUseItem({
    //                 item: "",
    //                 action: "open",
    //             });
    //             console.log(JSON.stringify(usedItem, null, 2));
    //             break;

    //         case "spawnMonster":
    //             break;

    //         default:
    //             console.warn("Unknown command:", command?.key, message);
    //             break;
    //     }
    // }

    async function look() {
        const lookResult = await commandLook({});
        players = lookResult.players;
        tile = lookResult.tile;
        monsters = lookResult.monsters;
        items = lookResult.items;
    }

    async function onMove(direction: Direction) {
        // Calculate new tile (TODO: get other metadata like description, etc.)
        const location = await commandMove({ direction });
        const geohash = location[0];

        // Load more grid data if parent geohash changes
        if (geohash.slice(0, -1) !== tile.geohash.slice(0, -1)) {
            grid.set(await loadMoreGrid(geohash, $grid));
        }

        if (geohash !== tile.geohash) {
            tile.geohash = geohash;
            tile = tile;
        }
    }

    function getCurrentTimestamp(): string {
        return new Date().toLocaleString("en-US", {
            hour: "numeric",
            minute: "numeric",
            hour12: true,
        });
    }

    function processMessageEvent(event: Event) {
        const { type: streamEvent, data } = event as MessageEvent;

        // Error events
        if (streamEvent === "error") {
            const { message } = data as FeedEvent;
            messageFeed = [
                ...messageFeed,
                {
                    id: messageFeed.length,
                    timestamp: getCurrentTimestamp(),
                    message,
                    name: "Error",
                },
            ];
        }
        // Feed events
        else if (streamEvent === "feed") {
            const { message, variables, type } = data as FeedEvent;

            // System feed
            if (type === "system") {
                messageFeed = [
                    ...messageFeed,
                    {
                        id: messageFeed.length,
                        timestamp: getCurrentTimestamp(),
                        message,
                        name: "System",
                    },
                ];
                return;
            }

            // Message feed
            else if (type === "message") {
                messageFeed = [
                    ...messageFeed,
                    {
                        id: messageFeed.length,
                        timestamp: getCurrentTimestamp(),
                        message: variables
                            ? (substituteVariables(
                                  message,
                                  variables,
                              ) as string)
                            : message,
                        name: "",
                    },
                ];
            }
        }
    }

    async function startStream() {
        [eventStream, closeStream] = await stream();
        eventStream.addEventListener("message", processMessageEvent);
    }

    function stopStream() {
        if (eventStream != null) {
            eventStream.removeEventListener("message", processMessageEvent);
        }
        if (closeStream != null) {
            closeStream();
        }
    }

    onMount(() => {
        // Start streaming crossover server events on login
        const unsubscribe = player.subscribe(async (p) => {
            if (p != null) {
                stopStream();
                await startStream();

                // Load grid
                grid.set(await loadMoreGrid(p.location[0], $grid));

                // Look at surroundings
                await look();
            } else {
                stopStream();
            }
        });

        return () => {
            stopStream();
            unsubscribe();
        };
    });
</script>

{#if !$player}
    <Onboard />
{:else}
    <GameWindow
        class="h-full p-3"
        {onGameCommand}
        {onMove}
        {messageFeed}
        {tile}
        {players}
        {items}
        {monsters}
    />
{/if}
