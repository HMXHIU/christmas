<script lang="ts">
    import type { MessageFeedUI } from "$lib/components/common/types";
    import GameWindow from "$lib/components/crossover/GameWindow.svelte";
    import Onboard from "$lib/components/crossover/Onboard.svelte";
    import { executeGameCommand, stream } from "$lib/crossover";
    import { actions } from "$lib/crossover/actions";
    import type { GameCommand } from "$lib/crossover/ir";
    import {
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
    import { substituteVariables } from "$lib/utils";
    import { onMount } from "svelte";
    import {
        grid,
        itemRecord,
        monsterRecord,
        player,
        playerRecord,
        tile,
    } from "../../store";
    import type {
        FeedEvent,
        UpdateEntitiesEvent,
    } from "../api/crossover/stream/+server";

    let messageFeed: MessageFeedUI[] = [];
    let eventStream: EventTarget | null = null;
    let closeStream: (() => void) | null = null;
    let streamStarted = false;

    async function onGameCommand(command: GameCommand) {
        try {
            const result = await executeGameCommand(command);
            if (result) {
                const {
                    players,
                    monsters,
                    items,
                    tile: newTile,
                    op,
                    status,
                    message,
                } = result;

                // Update message feed
                if (status === "failure" && message != null) {
                    addMessageFeed({ message, name: "Error" });
                }

                // Update tile
                if (newTile != null) {
                    tile.set(newTile);
                }

                // Update records
                if (players != null) {
                    const pr = players.reduce(
                        (acc, p) => {
                            acc[p.player] = p;
                            return acc;
                        },
                        {} as Record<string, Player>,
                    );
                    playerRecord.set(
                        op === "replace" ? pr : { ...$playerRecord, ...pr },
                    );
                    // Update player
                    for (const p of players) {
                        if (p.player === $player?.player) {
                            player.set(p);
                        }
                    }
                }
                if (monsters != null) {
                    const mr = monsters.reduce(
                        (acc, m) => {
                            acc[m.monster] = m;
                            return acc;
                        },
                        {} as Record<string, Monster>,
                    );
                    monsterRecord.set(
                        op === "replace" ? mr : { ...$monsterRecord, ...mr },
                    );
                }
                if (items != null) {
                    const ir = items.reduce(
                        (acc, i) => {
                            acc[i.item] = i;
                            return acc;
                        },
                        {} as Record<string, Item>,
                    );
                    itemRecord.set(
                        op === "replace" ? ir : { ...$itemRecord, ...ir },
                    );
                }
            }
        } catch (error: any) {
            addMessageFeed({ message: error.message, name: "Error" });
        }
    }

    async function onMove(direction: Direction) {
        if ($player != null) {
            await onGameCommand([
                actions.move,
                { self: $player },
                { queryIrrelevant: direction, query: "" },
            ]);
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
            addMessageFeed({ message, name: "Error" });
        }

        // System feed
        else if (type === "system") {
            addMessageFeed({ message, name: "System" });
        }

        // Message feed
        else if (type === "message") {
            addMessageFeed({
                message: variables
                    ? (substituteVariables(message, variables) as string)
                    : message,
                name: "",
            });
        }
    }

    function addMessageFeed({
        message,
        name,
    }: {
        message: string;
        name: string;
    }) {
        messageFeed = [
            ...messageFeed,
            {
                id: messageFeed.length,
                timestamp: getCurrentTimestamp(),
                message,
                name,
            },
        ];
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
                await onGameCommand([actions.look, { self: p }]);
            }
            // Stop streaming on logout
            else if (p == null) {
                stopStream();
            }

            if (p != null) {
                const geohash = p.location[0];

                // Geohash grid changed
                if (geohash.slice(0, -1) !== $tile.geohash.slice(0, -1)) {
                    // Load more grid biomes
                    grid.set(loadMoreGridBiomes(geohash, $grid));
                    // Look at surroundings
                    await onGameCommand([actions.look, { self: p }]);
                }

                // Update tile
                if (geohash !== $tile.geohash) {
                    const { precision, row, col } = geohashToGridCell(geohash);
                    const biome = $grid[precision][row][col].biome;
                    tile.set(tileAtGeohash(geohash, biome!));
                }
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
    <GameWindow class="h-full p-3" {onGameCommand} {onMove} {messageFeed} />
{/if}
