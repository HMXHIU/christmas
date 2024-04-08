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
    import ChatInput from "../common/ChatInput.svelte";
    import ChatWindow from "../common/ChatWindow.svelte";
    import type {
        ChatCommandGroupUI,
        ChatCommandUI,
        MessageFeedUI,
    } from "../common/types";
    import CommandAutocomplete from "./CommandAutocomplete.svelte";

    export let players: Player[] = [];
    export let monsters: Monster[] = [];
    export let items: Item[] = [];

    export let messageFeed: MessageFeedUI[] = [];
    export let defaultCommand: string;
    export let commandGroups: [ChatCommandGroupUI, ChatCommandUI[]][];

    export let onGameCommand: (gameCommand: GameCommand) => void;

    let gameCommands: GameCommand[] = [];

    async function onChatMessage(
        command: ChatCommandUI | null,
        message: string,
    ) {
        // TODO: replace with actual player's Actions & Abilities
        const playerActions: PropAction[] = Object.values(compendium).flatMap(
            (prop) => Object.values(prop.actions),
        );
        const playerAbilities: Ability[] = Object.values(abilities);

        gameCommands = searchAbilities({
            query: message,
            playerActions,
            playerAbilities,
            monsters,
            players,
            items,
            player: $player!,
        });

        console.log(JSON.stringify(gameCommands, null, 2));
    }
</script>

<section class={cn("flex flex-col", $$restProps.class)}>
    <!-- Chat Window -->
    <ChatWindow {messageFeed}></ChatWindow>

    <!-- Select Commands -->
    <CommandAutocomplete class="pb-2" {gameCommands} {onGameCommand}
    ></CommandAutocomplete>

    <!-- Chat Input -->
    <ChatInput {onChatMessage} {commandGroups} {defaultCommand}></ChatInput>
</section>
