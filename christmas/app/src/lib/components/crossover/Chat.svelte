<script lang="ts">
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
    import { player } from "../../../store";
    import ChatWindow from "../common/ChatWindow.svelte";
    import type { MessageFeedUI } from "../common/types";
    import ChatInput from "./ChatInput.svelte";
    import CommandAutocomplete from "./CommandAutocomplete.svelte";

    export let players: Player[] = [];
    export let monsters: Monster[] = [];
    export let items: Item[] = [];
    export let target: Player | Monster | Item | null = null;
    export let messageFeed: MessageFeedUI[] = [];
    export let onGameCommand: (gameCommand: GameCommand) => void;

    let gameCommands: GameCommand[] = [];
    let selectedGameCommand: GameCommand | null = null;

    async function onEnter(message: string) {
        // Clear game commands
        gameCommands = [];

        // Submit game command on enter
        if (selectedGameCommand) {
            onGameCommand(selectedGameCommand);
        }
    }

    async function onPartial(message: string) {
        if (message.length > 2) {
            // TODO: replace with actual player's Actions & Abilities
            const playerAbilities: Ability[] = Object.values(abilities);

            // Autocomplete game commands
            gameCommands = searchPossibleCommands({
                query: message,
                playerAbilities,
                playerItems: [], // TODO: replace with actual player's Items
                monsters,
                players,
                items,
                player: $player!,
            });
        } else {
            gameCommands = [];
        }
    }
</script>

<section class={cn("flex flex-col", $$restProps.class)}>
    <!-- Chat Window -->
    <ChatWindow {messageFeed}></ChatWindow>

    <!-- Select Commands -->
    <CommandAutocomplete
        class="pb-2"
        {gameCommands}
        bind:selected={selectedGameCommand}
        {onGameCommand}
    ></CommandAutocomplete>

    <!-- Chat Input -->
    <ChatInput bind:target {onEnter} {onPartial} {players} {monsters} {items}
    ></ChatInput>
</section>
