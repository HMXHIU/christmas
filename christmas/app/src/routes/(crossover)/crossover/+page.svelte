<script lang="ts">
    import GameWindow from "$lib/components/crossover/GameWindow.svelte";
    import Onboard from "$lib/components/crossover/Onboard.svelte";
    import {
        addMessageFeed,
        crossoverPlayerMetadata,
        executeGameCommand,
        handleUpdateEntities,
        stream,
        updateWorlds,
    } from "$lib/crossover";
    import { getPlayerAbilities } from "$lib/crossover/world/abilities";
    import { actions } from "$lib/crossover/world/actions";
    import type { Player } from "$lib/server/crossover/redis/entities";
    import { substituteVariables } from "$lib/utils";
    import { onDestroy, onMount } from "svelte";
    import { player, playerAbilities, userMetadata } from "../../../store";
    import type {
        ActionEvent,
        FeedEvent,
        UpdateEntitiesEvent,
    } from "../../api/crossover/stream/+server";

    let eventStream: EventTarget | null = null;
    let closeStream: (() => void) | null = null;
    let gameWindow: GameWindow;

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

    async function onLogin(player: Player) {
        // Fetch player metadata
        userMetadata.set(await crossoverPlayerMetadata());

        // Fetch player abilities
        playerAbilities.set(getPlayerAbilities(player));

        // Start streaming on login
        stopStream();
        await startStream();

        // Look at surroundings & update inventory
        await updateWorlds(player.loc[0]);
        await executeGameCommand([actions.look, { self: player }]);
        await executeGameCommand([actions.inventory, { self: player }]);
    }

    onMount(() => {
        if ($player) {
            onLogin($player);
        }
    });

    onDestroy(() => {
        stopStream();
    });
</script>

{#if !$player}
    <div class="container py-16">
        <Onboard {onLogin} />
    </div>
{:else}
    <GameWindow
        class="pt-0"
        onGameCommand={executeGameCommand}
        bind:this={gameWindow}
    />
{/if}
