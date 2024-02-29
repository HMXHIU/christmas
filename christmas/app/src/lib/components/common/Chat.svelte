<script lang="ts">
    import ChatWindow from "./ChatWindow.svelte";
    import type {
        ChatCommand,
        ChatCommandGroup,
        MessageFeed,
    } from "$lib/crossover/types";
    import ChatInput from "./ChatInput.svelte";
    import { cn } from "$lib/shadcn";

    export let messageFeed: MessageFeed[] = [];
    export let defaultCommand: string;
    export let commandGroups: [ChatCommandGroup, ChatCommand[]][];
    export let onChatMessage: (
        command: ChatCommand | null,
        message: string,
    ) => void;
</script>

<section class={cn("flex flex-col", $$restProps.class)}>
    <!-- Chat Window -->
    <ChatWindow {messageFeed}></ChatWindow>

    <!-- Chat Input -->
    <ChatInput {onChatMessage} {commandGroups} {defaultCommand}></ChatInput>
</section>
