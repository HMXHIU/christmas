<script lang="ts">
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
    import {
        itemRecord,
        monsterRecord,
        player,
        playerRecord,
    } from "../../../store";
    import ChatWindow from "../common/ChatWindow.svelte";
    import type { MessageFeedUI } from "../common/types";
    import AutocompleteGC from "./AutocompleteGC.svelte";
    import ChatInput from "./ChatInput.svelte";

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
</script>

<section class={cn("flex flex-col", $$restProps.class)}>
    <!-- Chat Window -->
    <ChatWindow {messageFeed}></ChatWindow>

    <!-- Select Commands -->
    <AutocompleteGC class="pb-2" {commands} {onGameCommand} bind:command
    ></AutocompleteGC>

    <!-- Chat Input -->
    <ChatInput bind:target {onEnter} {onPartial}></ChatInput>
</section>
