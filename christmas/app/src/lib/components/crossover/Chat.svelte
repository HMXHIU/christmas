<script lang="ts">
    import { actions } from "$lib/crossover/actions";
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
                actions: [actions.say, actions.look],
                monsters,
                players,
                items,
                player: $player!,
            }).commands;
        } else {
            commands = [];
        }
    }
</script>

<section class={cn("flex flex-col", $$restProps.class)}>
    <!-- Chat Window -->
    <ChatWindow {messageFeed}></ChatWindow>

    <!-- Select Commands -->
    <CommandAutocomplete class="pb-2" {commands} {onGameCommand} bind:command
    ></CommandAutocomplete>

    <!-- Chat Input -->
    <ChatInput bind:target {onEnter} {onPartial} {players} {monsters} {items}
    ></ChatInput>
</section>
