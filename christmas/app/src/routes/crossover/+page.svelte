<script lang="ts">
    import Footer from "$lib/components/crossover/Footer.svelte";
    import GameWindow from "$lib/components/crossover/GameWindow.svelte";
    import Onboard from "$lib/components/crossover/Onboard.svelte";
    import {
        addMessageFeed,
        handleGC,
        handleUpdateEntities,
        stream,
    } from "$lib/crossover";
    import { actions } from "$lib/crossover/actions";
    import { KeyboardController, type GameKey } from "$lib/crossover/keyboard";
    import {
        geohashToGridCell,
        loadMoreGridBiomes,
        type Direction,
    } from "$lib/crossover/world";
    import { tileAtGeohash } from "$lib/crossover/world/biomes";
    import { substituteVariables } from "$lib/utils";
    import { onMount } from "svelte";
    import { grid, player, tile } from "../../store";
    import type {
        FeedEvent,
        UpdateEntitiesEvent,
    } from "../api/crossover/stream/+server";

    let eventStream: EventTarget | null = null;
    let closeStream: (() => void) | null = null;
    let streamStarted = false;

    async function onMove(direction: Direction) {
        if ($player != null) {
            await handleGC([
                actions.move,
                { self: $player },
                { queryIrrelevant: direction, query: "" },
            ]);
        }
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

    function processUpdateEntities(event: Event) {
        const { players, items, monsters } = (event as MessageEvent)
            .data as UpdateEntitiesEvent;
        handleUpdateEntities({ players, items, monsters });
    }

    function onKeys(keys: GameKey[]) {
        // Movement (isometric)
        if (keys.includes("up")) {
            if (keys.includes("left")) onMove("w");
            else if (keys.includes("right")) onMove("n");
            else onMove("nw");
        } else if (keys.includes("down")) {
            if (keys.includes("left")) onMove("s");
            else if (keys.includes("right")) onMove("e");
            else onMove("se");
        } else if (keys.includes("left")) {
            if (keys.includes("up")) onMove("sw");
            else if (keys.includes("down")) onMove("s");
            else onMove("sw");
        } else if (keys.includes("right")) {
            if (keys.includes("up")) onMove("n");
            else if (keys.includes("down")) onMove("ne");
            else onMove("ne");
        }
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
        const unsubscribePlayer = player.subscribe(async (p) => {
            // Start streaming on login
            if (p != null && !streamStarted) {
                stopStream();
                await startStream();
                streamStarted = true;

                // Load grid
                grid.set(loadMoreGridBiomes(p.location[0], $grid));

                // Look at surroundings & update inventory
                await handleGC([actions.look, { self: p }]);
                await handleGC([actions.inventory, { self: p }]);
            }

            // Stop streaming on logout
            else if (p == null) {
                stopStream();
            }

            // Player updated
            if (p != null) {
                const geohash = p.location[0];

                // Geohash grid changed
                if (geohash.slice(0, -1) !== $tile.geohash.slice(0, -1)) {
                    // Load more grid biomes
                    grid.set(loadMoreGridBiomes(geohash, $grid));
                    // Look at surroundings
                    await handleGC([actions.look, { self: p }]);
                }

                // Update tile
                if (geohash !== $tile.geohash) {
                    const { precision, row, col } = geohashToGridCell(geohash);
                    const biome = $grid[precision][row][col].biome;
                    tile.set(tileAtGeohash(geohash, biome!));
                }
            }
        });

        // Keyboard keys
        const keyboardController = new KeyboardController();
        const unsubscribeKeyboard = keyboardController.subscribe(onKeys);

        return () => {
            stopStream();
            unsubscribePlayer();
            unsubscribeKeyboard();
        };
    });
</script>

{#if !$player}
    <Onboard />
{:else}
    <GameWindow class="h-full p-3" onGameCommand={handleGC} {onMove} />
{/if}

<!-- Footer -->
<Footer />
