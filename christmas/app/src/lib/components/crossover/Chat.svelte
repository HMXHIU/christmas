<script lang="ts">
    import { searchAbilities, type GameCommand } from "$lib/crossover/ir";
    import { type Ability } from "$lib/crossover/world/abilities";
    import type { PropAction } from "$lib/crossover/world/compendium";
    import { abilities, compendium } from "$lib/crossover/world/settings";
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
    import type { ChatCommandGroupUI, ChatCommandUI } from "./types";

    export let players: Player[] = [];
    export let monsters: Monster[] = [];
    export let items: Item[] = [];
    export let target: Player | Monster | Item | null = null;

    export let messageFeed: MessageFeedUI[] = [];
    export let defaultCommand: string;
    export let commandGroups: [ChatCommandGroupUI, ChatCommandUI[]][];

    export let onGameCommand: (gameCommand: GameCommand) => void;

    let gameCommands: GameCommand[] = [];

    async function onEnter(message: string) {
        gameCommands = []; // clear game commands
    }

    async function onPartial(message: string) {
        if (message.length > 2) {
            // TODO: replace with actual player's Actions & Abilities
            const playerActions: PropAction[] = Object.values(
                compendium,
            ).flatMap((prop) => Object.values(prop.actions));
            const playerAbilities: Ability[] = Object.values(abilities);

            // Autocomplete game commands
            gameCommands = searchAbilities({
                query: message,
                playerActions,
                playerAbilities,
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
    <CommandAutocomplete class="pb-2" {gameCommands} {onGameCommand}
    ></CommandAutocomplete>

    <!-- Chat Input -->
    <ChatInput
        bind:target
        {onEnter}
        {onPartial}
        {commandGroups}
        {defaultCommand}
        {players}
        {monsters}
        {items}
    ></ChatInput>
</section>
