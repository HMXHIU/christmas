<script lang="ts">
    import ChatWindow from "./ChatWindow.svelte";
    import type { ChatCommand, MessageFeed } from "$lib/crossover/types";
    import ChatInput from "./ChatInput.svelte";

    export let messageFeed: MessageFeed[] = [];
    export let onChatMessage: (
        command: ChatCommand | null,
        message: string,
    ) => void;
</script>

<section class="card">
    <div class="chat w-full h-full grid grid-cols-1 lg:grid-cols-[30%_1fr]">
        <div class="grid grid-row-[1fr_auto]">
            <!-- Chat Window -->
            <ChatWindow {messageFeed}></ChatWindow>

            <!-- Chat Input -->
            <ChatInput {onChatMessage}></ChatInput>
        </div>
    </div>
</section>
