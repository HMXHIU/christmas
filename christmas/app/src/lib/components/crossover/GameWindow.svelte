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
        // Compute game container top/bottom
        const rect = gameContainer.getBoundingClientRect();
        gameTop = `${rect.top}px`;
        gameBottom = `${window.innerHeight - rect.bottom}px`;
        console.log(rect);
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
        style="height: calc(80% - 50px); flex-shrink-0"
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
        width: 75%;
        max-width: 1000px;
        left: 0;
        right: 0;
        margin-left: auto;
        margin-right: auto;
        border-top-left-radius: 20px;
        border-top-right-radius: 20px;
        height: 120px;
    }
</style>
