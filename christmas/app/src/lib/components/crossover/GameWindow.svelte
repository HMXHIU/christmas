<script lang="ts">
    import * as Resizable from "$lib/components/ui/resizable";
    import { ScrollArea } from "$lib/components/ui/scroll-area";
    import {
        searchPossibleCommands,
        type GameCommand,
    } from "$lib/crossover/ir";
    import { playerActions } from "$lib/crossover/world/actions";
    import { cn } from "$lib/shadcn";
    import { onDestroy, onMount } from "svelte";
    import type { ActionEvent } from "../../../routes/api/crossover/stream/+server";
    import {
        inGame,
        itemRecord,
        monsterRecord,
        player,
        playerAbilities,
        playerEquippedItems,
        playerRecord,
    } from "../../../store";
    import AutocompleteGC from "./AutocompleteGC.svelte";
    import AvatarSigil from "./AvatarSigil.svelte";
    import ChatInput from "./ChatInput.svelte";
    import ChatWindow from "./ChatWindow.svelte";
    import Game from "./Game";
    import Look from "./Look.svelte";
    import Tool from "./Tool.svelte";

    export let onGameCommand: (command: GameCommand) => Promise<void>;

    const LARGE_SCREEN = 800;

    let innerWidth: number; // window.innerWidth
    let gameTop = "0px";
    let gameBottom = "0px";
    let commands: GameCommand[] = [];
    let command: GameCommand | null = null;
    let gameRef: Game;
    let gameContainer: HTMLDivElement;

    export async function handleActionEvent(event: ActionEvent) {
        gameRef.drawActionEvent(event);
    }

    async function onEnterKeyPress(message: string) {
        // Clear game commands
        commands = [];

        // Submit game command on enter
        if (command) {
            onGameCommand(command);
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

    onMount(() => {
        // Go into game mode
        inGame.set(true);

        // Compute game container top/bottom
        const rect = gameContainer.getBoundingClientRect();
        gameTop = `${rect.top}px`;
        gameBottom = `${window.innerHeight - rect.bottom}px`;
    });

    onDestroy(() => {
        // Exit game mode
        inGame.set(false);
    });
</script>

<svelte:window bind:innerWidth />

<div
    class={cn(
        "h-[calc(100dvh)] w-full flex flex-col justify-between",
        $$restProps.class,
    )}
>
    <!-- Game (account for chat input) -->
    <div
        style="height: calc(80% - 65px)"
        class="shrink-0"
        bind:this={gameContainer}
    >
        <Game bind:this={gameRef} previewCommand={command}></Game>
    </div>

    <!-- Environment Overlay -->
    <div
        id="environment-overlay"
        class="p-2 bg-background bg-opacity-75"
        style="--game-top: {gameTop};"
    >
        <Look></Look>
    </div>

    <!-- Narrator Overlay -->
    <div
        id="narrator-overlay"
        class="p-2 bg-background bg-opacity-50"
        style="--game-bottom: {gameBottom};"
    >
        <!-- Chat Window -->
        <ChatWindow></ChatWindow>
    </div>

    <!-- Player Sigil Overlay -->
    <div id="player-overlay" class="p-3" style="--game-bottom: {gameBottom};">
        <AvatarSigil player={$player} />
    </div>

    <!-- Chat Input -->
    <ChatInput class="m-2" {onEnterKeyPress} {onPartial}></ChatInput>

    <!-- Autocomplete Game Commands -->
    <div class="relative">
        <AutocompleteGC
            class="pb-2 px-2 bottom-0 absolute"
            {commands}
            {onGameCommand}
            bind:command
        ></AutocompleteGC>
    </div>

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
        border-bottom-left-radius: 20px;
        border-bottom-right-radius: 20px;
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
        border-top-left-radius: 20px;
        border-top-right-radius: 20px;
        height: 120px;
    }
    #player-overlay {
        position: absolute;
        bottom: var(--game-bottom); /* computed on mount */
    }
</style>
