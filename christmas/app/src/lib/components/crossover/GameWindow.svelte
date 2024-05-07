<script lang="ts">
    import * as Resizable from "$lib/components/ui/resizable";
    import { ScrollArea } from "$lib/components/ui/scroll-area";
    import { playerActions } from "$lib/crossover/actions";
    import {
        searchPossibleCommands,
        type GameCommand,
    } from "$lib/crossover/ir";
    import { type Ability } from "$lib/crossover/world/abilities";
    import { abilities } from "$lib/crossover/world/settings";
    import type {
        Item,
        Monster,
        Player,
    } from "$lib/server/crossover/redis/entities";
    import { cn } from "$lib/shadcn";
    import { Assets } from "pixi.js";
    import { onMount } from "svelte";
    import {
        itemRecord,
        monsterRecord,
        player,
        playerRecord,
    } from "../../../store";
    import ChatWindow from "../common/ChatWindow.svelte";
    import AutocompleteGC from "./AutocompleteGC.svelte";
    import ChatInput from "./ChatInput.svelte";
    import Look from "./Look.svelte";
    import Map from "./Map.svelte";

    const LARGE_SCREEN = 800;
    let innerWidth: number; // window.innerWidth

    export let target: Player | Monster | Item | null = null;
    export let onGameCommand: (command: GameCommand) => Promise<void>;

    let commands: GameCommand[] = [];
    let command: GameCommand | null = null;

    async function onEnter(message: string) {
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

    onMount(async () => {
        // Load assets in background
        await Assets.init({ manifest: "/sprites/manifest.json" });
        Assets.backgroundLoadBundle(["player", "biomes", "bestiary", "props"]);
    });
</script>

<svelte:window bind:innerWidth />

<div class={cn("w-full flex flex-col justify-end", $$restProps.class)}>
    <div class="h-1/2">
        {#if innerWidth > LARGE_SCREEN}
            <Resizable.PaneGroup direction="horizontal">
                <!-- Chat Window -->
                <Resizable.Pane class="p-3">
                    <ChatWindow></ChatWindow>
                </Resizable.Pane>
                <Resizable.Handle withHandle />
                <!-- Look (TODO: doesnt seem to scroll inside resizable) -->
                <Resizable.Pane class="p-3">
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

    <!-- Autocomplete Game Commands -->
    <AutocompleteGC class="pb-2 px-2" {commands} {onGameCommand} bind:command
    ></AutocompleteGC>

    <!-- Chat Input -->
    <ChatInput class="m-2" bind:target {onEnter} {onPartial}></ChatInput>

    <!-- Map -->
    <div class="h-1/2">
        <Map></Map>
    </div>
</div>
