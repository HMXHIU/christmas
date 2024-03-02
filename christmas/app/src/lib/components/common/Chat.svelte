<script lang="ts">
    import { cn } from "$lib/shadcn";
    import ChatInput from "./ChatInput.svelte";
    import ChatWindow from "./ChatWindow.svelte";
    import type {
        ChatCommandGroupUI,
        ChatCommandUI,
        MessageFeedUI,
    } from "./types";

    export let messageFeed: MessageFeedUI[] = [];
    export let defaultCommand: string;
    export let commandGroups: [ChatCommandGroupUI, ChatCommandUI[]][];
    export let onChatMessage: (
        command: ChatCommandUI | null,
        message: string,
    ) => void;
</script>

<section class={cn("flex flex-col", $$restProps.class)}>
    <!-- Chat Window -->
    <ChatWindow {messageFeed}></ChatWindow>

    <!-- Chat Input -->
    <ChatInput {onChatMessage} {commandGroups} {defaultCommand}></ChatInput>
</section>
