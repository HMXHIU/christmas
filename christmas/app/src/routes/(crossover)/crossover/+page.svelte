<script lang="ts">
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
    import { type Direction } from "$lib/crossover/world/types";
    import { substituteVariables } from "$lib/utils";
    import { onMount } from "svelte";
    import { player } from "../../../store";
    import type {
        FeedEvent,
        UpdateEntitiesEvent,
    } from "../../api/crossover/stream/+server";

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
            addMessageFeed({
                message,
                name: "Error",
                messageFeedType: "error",
            });
        }

        // System feed
        else if (type === "system") {
            addMessageFeed({
                message,
                name: "System",
                messageFeedType: "system",
            });
        }

        // Message feed
        else if (type === "message") {
            addMessageFeed({
                message: variables
                    ? (substituteVariables(message, variables) as string)
                    : message,
                name: "",
                messageFeedType: "message",
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
        // TODO: DANGEROUS look will change player which will call look -> change player
        const unsubscribePlayer = player.subscribe(async (p) => {
            // Start streaming on login
            if (p != null && !streamStarted) {
                stopStream();
                await startStream();
                streamStarted = true;

                // Look at surroundings & update inventory
                await handleGC([actions.look, { self: p }]);
                await handleGC([actions.inventory, { self: p }]);
            }

            // Stop streaming on logout
            else if (p == null) {
                stopStream();
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
    <GameWindow class="pt-2" onGameCommand={handleGC} {onMove} />
{/if}
