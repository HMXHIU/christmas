<script lang="ts">
    import * as Resizable from "$lib/components/ui/resizable";
    import { ScrollArea } from "$lib/components/ui/scroll-area";
    import {
        searchPossibleCommands,
        type GameCommand,
    } from "$lib/crossover/ir";
    import { playerActions } from "$lib/crossover/world/actions";
    import { cn } from "$lib/shadcn";
    import { substituteVariables } from "$lib/utils";
    import { gsap } from "gsap";
    import { onDestroy, onMount } from "svelte";
    import { addMessageFeed } from ".";
    import {
        feedEvent,
        inGame,
        itemRecord,
        monsterRecord,
        player,
        playerAbilities,
        playerEquippedItems,
        playerRecord,
    } from "../../../../store";
    import AutocompleteGC from "../AutocompleteGC.svelte";
    import ChatInput from "../ChatInput.svelte";
    import ChatWindow from "../ChatWindow.svelte";
    import Game, { executeGameCommand } from "../Game";
    import { initAssetManager } from "../Game/utils";
    import Look from "../Look.svelte";
    import Map from "../Map/Map.svelte";
    import Tool from "../Tool.svelte";

    const LARGE_SCREEN = 1000;
    const MEDIUM_SCREEN = 800;
    const MAP_SIZE = 150;

    let innerWidth: number; // bound to window.innerWidth
    let innerHeight: number; // bound to window.innerHeight
    let gameTop = 0;
    let gameBottom = 0;
    let mapSizeExpanded = 0;
    let commands: GameCommand[] = [];
    let command: GameCommand | null = null;
    let gameContainer: HTMLDivElement;
    let isMapExpanded = false;

    function toggleMapSize(event: MouseEvent) {
        const mapElement = event.currentTarget as HTMLElement;

        if (isMapExpanded) {
            gsap.to(mapElement, {
                duration: 0.5,
                width: MAP_SIZE,
                height: MAP_SIZE,
                right: 0,
                top: gameTop,
                ease: "power2.out",
            });
        } else {
            gsap.to(mapElement, {
                duration: 0.5,
                width: mapSizeExpanded,
                height: mapSizeExpanded,
                right: Math.round((innerWidth - mapSizeExpanded) / 2),
                top: Math.round((innerHeight - mapSizeExpanded) / 3),
                ease: "power2.out",
            });
        }

        isMapExpanded = !isMapExpanded;
    }

    async function onEnterKeyPress(message: string) {
        // Clear game commands
        commands = [];

        // Submit game command on enter
        if (command) {
            await onGameCommand(command);
        }
    }

    async function onPartial(message: string) {
        if (message.length > 2) {
            // Autocomplete game commands
            commands = searchPossibleCommands({
                query: message,
                playerAbilities: $playerAbilities,
                playerItems: $playerEquippedItems, // Only search on equiped items
                actions: playerActions,
                monsters: Object.values($monsterRecord),
                players: Object.values($playerRecord),
                items: Object.values($itemRecord),
                player: $player!,
            }).commands;
        } else {
            commands = [];
        }
    }

    async function onGameCommand(command: GameCommand) {
        await executeGameCommand(command);
    }

    onMount(() => {
        // Go into game mode
        inGame.set(true);

        initAssetManager();

        // Compute game container top/bottom
        const rect = gameContainer.getBoundingClientRect();
        gameTop = rect.top;
        gameBottom = window.innerHeight - rect.bottom;

        // Computer map size expanded
        mapSizeExpanded = Math.round(
            Math.min(window.innerWidth, window.innerHeight) * 0.9,
        );

        // Store subscriptions
        const subscriptions = [
            feedEvent.subscribe(async (e) => {
                if (!e) return;
                const { type, message, variables } = e;
                // Error events
                if (type === "error") {
                    addMessageFeed({
                        message,
                        name: "Error",
                        messageFeedType: type,
                    });
                }

                // System feed
                else if (type === "system") {
                    addMessageFeed({
                        message,
                        name: "System",
                        messageFeedType: type,
                    });
                }

                // Message feed
                else if (type === "message") {
                    addMessageFeed({
                        message: variables
                            ? (substituteVariables(
                                  message,
                                  variables,
                              ) as string)
                            : message,
                        name: "",
                        messageFeedType: type,
                    });
                }
            }),
        ];

        return () => {
            for (const unsubscribe of subscriptions) {
                unsubscribe();
            }
        };
    });

    onDestroy(() => {
        // Exit game mode
        inGame.set(false);
    });
</script>

<svelte:window bind:innerWidth bind:innerHeight />

<div
    class={cn(
        "h-[calc(100dvh)] w-full flex flex-col justify-between",
        $$restProps.class,
    )}
>
    <!-- Game (account for chat input) -->
    <div
        style="height: calc(80% - 52px)"
        class="shrink-0"
        bind:this={gameContainer}
    >
        <Game previewCommand={command}></Game>
    </div>

    <!-- Environment Overlay -->
    <div
        id="environment-overlay"
        class="p-2 bg-background bg-opacity-75"
        style="--game-top: {gameTop}px;"
    >
        <Look></Look>
    </div>

    <!-- Narrator Overlay -->
    <div
        id="narrator-overlay"
        class="p-2 bg-background bg-opacity-50"
        style="--game-bottom: {gameBottom}px;"
    >
        <!-- Chat Window -->
        <ChatWindow></ChatWindow>
    </div>

    <!-- Map Overlay -->
    <button
        id="map-overlay"
        class="p-3"
        style="--game-top: {gameTop}px; --map-size: {MAP_SIZE}px;"
        on:click={toggleMapSize}
    >
        <Map></Map>
    </button>

    <!-- Autocomplete Game Commands -->
    <div class="relative">
        <AutocompleteGC
            class="pb-2 px-2 bottom-0 absolute"
            {commands}
            {onGameCommand}
            bind:command
        ></AutocompleteGC>
    </div>

    <!-- Chat Input -->
    <ChatInput class="mb-1 mt-0 py-0" {onEnterKeyPress} {onPartial}></ChatInput>

    <!-- Toolbar -->
    <div class="h-1/5 shrink">
        {#if innerWidth > LARGE_SCREEN}
            <Resizable.PaneGroup direction="horizontal">
                <!-- Inventory/Utilities -->
                <Resizable.Pane class="px-2">
                    <Tool tool="inventory"></Tool>
                </Resizable.Pane>
                <Resizable.Handle />
                <!-- Abilities/ -->
                <Resizable.Pane class="px-2">
                    <Tool tool="abilities"></Tool>
                </Resizable.Pane>
                <Resizable.Handle />
                <!-- Actions -->
                <Resizable.Pane class="px-2">
                    <Tool tool="actions"></Tool>
                </Resizable.Pane>
            </Resizable.PaneGroup>
        {:else if innerWidth > MEDIUM_SCREEN}
            <Resizable.PaneGroup direction="horizontal">
                <!-- Inventory/Utilities -->
                <Resizable.Pane class="px-2">
                    <Tool tool="inventory"></Tool>
                </Resizable.Pane>
                <Resizable.Handle />
                <!-- Abilities/ -->
                <Resizable.Pane class="px-2">
                    <Tool tool="abilities"></Tool>
                </Resizable.Pane>
                <Resizable.Handle />
            </Resizable.PaneGroup>
        {:else}
            <!-- Inventory -->
            <ScrollArea orientation="vertical">
                <Tool tool="inventory"></Tool>
            </ScrollArea>
        {/if}
    </div>
</div>

<style>
    #environment-overlay {
        position: absolute;
        top: var(--game-top); /* computed on mount */
        width: 50%;
        max-width: 600px;
        left: 0;
        right: 0;
        margin-left: auto;
        margin-right: auto;
        border-bottom-left-radius: 10px;
        border-bottom-right-radius: 10px;
    }
    #narrator-overlay {
        position: absolute;
        bottom: var(--game-bottom); /* computed on mount */
        width: 70%;
        max-width: 1000px;
        left: 0;
        right: 0;
        margin-left: auto;
        margin-right: auto;
        border-top-left-radius: 10px;
        border-top-right-radius: 10px;
        height: 100px;
    }
    #map-overlay {
        position: absolute;
        top: var(--game-top); /* computed on mount */
        right: 0;
        cursor: pointer;
        width: var(--map-size);
        height: var(--map-size);
    }
</style>
