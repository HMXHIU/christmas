<script lang="ts">
    import GameWindow from "$lib/components/crossover/GameWindow.svelte";
    import Onboard from "$lib/components/crossover/Onboard.svelte";
    import {
        crossoverCmdLook,
        crossoverCmdMove,
        executeGameCommand,
        stream,
    } from "$lib/crossover";

    import type { MessageFeedUI } from "$lib/components/common/types";

    import type { GameCommand } from "$lib/crossover/ir";
    import {
        abyssTile,
        geohashToGridCell,
        loadMoreGridBiomes,
        type Direction,
    } from "$lib/crossover/world";
    import { tileAtGeohash } from "$lib/crossover/world/biomes";
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
    import type {
        FeedEvent,
        UpdateEntitiesEvent,
    } from "../api/crossover/stream/+server";

    let messageFeed: MessageFeedUI[] = [];
    let eventStream: EventTarget | null = null;
    let closeStream: (() => void) | null = null;
    let tile: z.infer<typeof TileSchema> = abyssTile;

    let playerRecord: Record<string, Player> = {};
    let itemRecord: Record<string, Item> = {};
    let monsterRecord: Record<string, Monster> = {};

    let streamStarted = false;

    async function onGameCommand(command: GameCommand) {
        const result = await executeGameCommand(command);
    }

    // TODO: convert these to special commands
    //
    // async function onChatMessage(
    //     command: ChatCommandUI | null,
    //     message: string,
    // ) {
    //     switch (command?.key) {
    //         case "say":
    //             await crossoverCmdSay({ message });
    //             break;

    //         case "look":
    //             await look();
    //             break;

    //         case "spawnItem":
    //             // Test spawn wooden door
    //             const item = await crossoverCmdCreateItem({
    //                 geohash: tile.geohash,
    //                 prop: compendium.woodenDoor.prop,
    //             });
    //             console.log(JSON.stringify(item, null, 2));
    //             break;

    //         case "useItem":
    //             // Test use wooden door
    //             const usedItem = await crossoverCmdUseItem({
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
        const {
            players,
            tile: newTile,
            monsters,
            items,
        } = await crossoverCmdLook({}); // crossoverCmdLook updates grid

        playerRecord = players.reduce(
            (acc, p) => {
                acc[p.player] = p;
                return acc;
            },
            {} as Record<string, Player>,
        );
        monsterRecord = monsters.reduce(
            (acc, m) => {
                acc[m.monster] = m;
                return acc;
            },
            {} as Record<string, Monster>,
        );
        itemRecord = items.reduce(
            (acc, i) => {
                acc[i.item] = i;
                return acc;
            },
            {} as Record<string, Item>,
        );
        tile = newTile;
    }

    async function onMove(direction: Direction) {
        // Calculate new tile (TODO: get other metadata like description, etc.)
        const { players } = await crossoverCmdMove({ direction });

        // Update player record
        updateEntityRecords({ players });

        if ($player != null) {
            const geohash = $player.location[0];

            // Geohash grid changed
            if (geohash.slice(0, -1) !== tile.geohash.slice(0, -1)) {
                // Load more grid biomes
                grid.set(loadMoreGridBiomes(geohash, $grid));
                // Look at surroundings
                await look();
            }

            // Update tile
            if (geohash !== tile.geohash) {
                const { precision, row, col } = geohashToGridCell(geohash);
                const biome = $grid[precision][row][col].biome;
                tile = tileAtGeohash(geohash, biome!);
            }
        }
    }

    function updateEntityRecords({
        players,
        monsters,
        items,
    }: {
        players?: Player[];
        monsters?: Monster[];
        items?: Item[];
    }) {
        if (players != null) {
            for (const p of players) {
                playerRecord[p.player] = p;

                // Update player
                if ($player != null && p.player === $player.player) {
                    player.set(p);
                }
            }
        }
        if (monsters != null) {
            for (const m of monsters) {
                monsterRecord[m.monster] = m;
            }
        }
        if (items != null) {
            for (const i of items) {
                itemRecord[i.item] = i;
            }
        }
    }

    function getCurrentTimestamp(): string {
        return new Date().toLocaleString("en-US", {
            hour: "numeric",
            minute: "numeric",
            hour12: true,
        });
    }

    function processFeedEvent(event: Event) {
        const { data } = event as MessageEvent;
        const { type, message, variables } = data as FeedEvent;

        // Error events
        if (type === "error") {
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
                        ? (substituteVariables(message, variables) as string)
                        : message,
                    name: "",
                },
            ];
        }
    }

    function processUpdateEntities(event: Event) {
        const { players, monsters, items } = (event as MessageEvent)
            .data as UpdateEntitiesEvent;

        console.log(JSON.stringify(players, null, 2));
        console.log(JSON.stringify(monsters, null, 2));
        console.log(JSON.stringify(items, null, 2));
    }

    async function startStream() {
        [eventStream, closeStream] = await stream();
        eventStream.addEventListener("feed", processFeedEvent);
        eventStream.addEventListener("entities", processUpdateEntities);
    }

    function stopStream() {
        if (eventStream != null) {
            eventStream.removeEventListener("feed", processFeedEvent);
            eventStream.removeEventListener("entities", processUpdateEntities);
        }
        if (closeStream != null) {
            closeStream();
        }
    }

    onMount(() => {
        const unsubscribe = player.subscribe(async (p) => {
            // Start streaming on login
            if (p != null && !streamStarted) {
                stopStream();
                await startStream();
                streamStarted = true;

                // Load grid
                grid.set(loadMoreGridBiomes(p.location[0], $grid));

                // Look at surroundings
                await look();
            }
            // Stop streaming on logout
            else if (p == null) {
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
        {playerRecord}
        {itemRecord}
        {monsterRecord}
    />
{/if}
