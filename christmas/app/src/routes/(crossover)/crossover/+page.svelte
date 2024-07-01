<script lang="ts">
    import GameWindow from "$lib/components/crossover/GameWindow.svelte";
    import Onboard from "$lib/components/crossover/Onboard.svelte";
    import {
        addMessageFeed,
        executeGameCommand,
        handleUpdateEntities,
        stream,
        updateWorlds,
    } from "$lib/crossover";
    import { actions } from "$lib/crossover/world/actions";
    import { type Direction } from "$lib/crossover/world/types";
    import { substituteVariables } from "$lib/utils";
    import { onMount } from "svelte";
    import { player } from "../../../store";
    import type {
        ActionEvent,
        FeedEvent,
        UpdateEntitiesEvent,
    } from "../../api/crossover/stream/+server";

    let eventStream: EventTarget | null = null;
    let closeStream: (() => void) | null = null;
    let streamStarted = false;
    let gameWindow: GameWindow;

    async function onMove(direction: Direction) {
        if ($player != null) {
            await executeGameCommand([
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

    function processActions(event: Event) {
        const actionEvent = (event as MessageEvent).data as ActionEvent;
        gameWindow.handleActionEvent(actionEvent);
    }

    function processUpdateEntities(event: Event) {
        const { players, items, monsters, op } = (event as MessageEvent)
            .data as UpdateEntitiesEvent;
        handleUpdateEntities({ players, items, monsters }, op);
    }

    async function startStream() {
        [eventStream, closeStream] = await stream();
        eventStream.addEventListener("feed", processFeedEvent);
        eventStream.addEventListener("entities", processUpdateEntities);
        eventStream.addEventListener("action", processActions);
    }

    function stopStream() {
        if (eventStream != null) {
            eventStream.removeEventListener("feed", processFeedEvent);
            eventStream.removeEventListener("entities", processUpdateEntities);
            eventStream.addEventListener("action", processActions);
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
                await updateWorlds(p.loc[0]);
                await executeGameCommand([actions.look, { self: p }]);
                await executeGameCommand([actions.inventory, { self: p }]);
            }

            // Stop streaming on logout
            else if (p == null) {
                stopStream();
            }
        });

        return () => {
            stopStream();
            unsubscribePlayer();
        };
    });
</script>

{#if !$player}
    <div class="container">
        <Onboard />
    </div>
{:else}
    <GameWindow
        class="pt-2"
        onGameCommand={executeGameCommand}
        bind:this={gameWindow}
    />
{/if}
