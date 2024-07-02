<script lang="ts">
    import * as Resizable from "$lib/components/ui/resizable";
    import { ScrollArea } from "$lib/components/ui/scroll-area";
    import {
        searchPossibleCommands,
        type GameCommand,
    } from "$lib/crossover/ir";
    import { abilities, type Ability } from "$lib/crossover/world/abilities";
    import { playerActions } from "$lib/crossover/world/actions";
    import { cn } from "$lib/shadcn";
    import { onMount } from "svelte";
    import type { ActionEvent } from "../../../routes/api/crossover/stream/+server";
    import {
        itemRecord,
        monsterRecord,
        player,
        playerRecord,
    } from "../../../store";
    import AutocompleteGC from "./AutocompleteGC.svelte";
    import ChatInput from "./ChatInput.svelte";
    import ChatWindow from "./ChatWindow.svelte";
    import Game from "./Game";
    import Look from "./Look.svelte";

    export let onGameCommand: (command: GameCommand) => Promise<void>;

    const LARGE_SCREEN = 800;

    let innerWidth: number; // window.innerWidth
    let overlayTop = "0px";
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
            // TODO: replace with actual player's Actions & Abilities
            const playerAbilities: Ability[] = Object.values(abilities);

            // Autocomplete game commands
            commands = searchPossibleCommands({
                query: message,
                playerAbilities,
                playerItems: [], // TODO: replace with actual player's Items
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
        const gameRect = gameContainer.getBoundingClientRect();
        console.log(gameRect.top);
        overlayTop = `${gameRect.top}px`;
    });
</script>

<svelte:window bind:innerWidth />

<div
    class={cn(
        "h-[calc(100dvh-9rem)] w-full flex flex-col justify-between",
        $$restProps.class,
    )}
>
    <!-- Game (50px is size of ChatInput) -->
    <div
        style="height: calc(75% - 50px); flex-shrink-0"
        class="shrink-0"
        bind:this={gameContainer}
    >
        <Game bind:this={gameRef} previewCommand={command}></Game>
    </div>

    <!-- Look Overlay -->
    <div id="overlay" class="p-2" style="--overlay-top: {overlayTop};">
        <Look></Look>
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
    <div class="h-1/4 shrink">
        {#if innerWidth > LARGE_SCREEN}
            <Resizable.PaneGroup direction="horizontal">
                <!-- Chat Window -->
                <Resizable.Pane class="px-2 pt-2">
                    <ChatWindow></ChatWindow>
                </Resizable.Pane>
                <Resizable.Handle withHandle />
                <!-- Look (TODO: doesnt seem to scroll inside resizable) -->
                <Resizable.Pane class="px-2 pt-2">
                    <ScrollArea orientation="vertical">
                        <Look></Look>
                    </ScrollArea>
                </Resizable.Pane>
            </Resizable.PaneGroup>
        {:else}
            <!-- Chat Window -->
            <ChatWindow></ChatWindow>
        {/if}
    </div>
</div>

<style>
    #overlay {
        position: absolute;
        top: var(--overlay-top); /* Set dynamically in onMount */
        width: 400px;
        @apply bg-background;
        opacity: 0.75;
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: 1.5em;
        left: 50%;
        transform: translateX(-50%);
    }
</style>
