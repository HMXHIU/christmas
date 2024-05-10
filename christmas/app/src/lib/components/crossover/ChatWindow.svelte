<script lang="ts">
    import type { MessageFeed } from "$lib/crossover";
    import { cn } from "$lib/shadcn";
    import { getCurrentTimestamp } from "$lib/utils";
    import { onMount } from "svelte";
    import { messageFeed } from "../../../store";
    import Look from "./Look.svelte";

    const ERROR_TIMESPAN = 5000;

    let chatWindow: HTMLElement;
    let systemMessage: MessageFeed | undefined;

    $: onNewMessages($messageFeed);

    function scrollChatBottom(behavior?: ScrollBehavior): void {
        chatWindow?.scrollTo({ top: chatWindow.scrollHeight, behavior });
    }

    function onNewMessages(messages: MessageFeed[]): void {
        const now = new Date().getTime();
        // Get the last valid error or system message
        systemMessage = messages
            .reverse()
            .filter((m) => {
                return m.timestamp.getTime() > now - ERROR_TIMESPAN;
            })
            .find(
                (message) =>
                    message.messageFeedType === "error" ||
                    message.messageFeedType === "system",
            );
        setTimeout(() => {
            systemMessage = undefined;
        }, ERROR_TIMESPAN);
        // Scroll to the bottom of the chat window
        setTimeout(() => {
            scrollChatBottom("smooth");
        }, 0);
    }

    onMount(() => {
        scrollChatBottom();
    });
</script>

<div
    class={cn("h-full w-full flex flex-col justify-between", $$restProps.class)}
>
    <section
        bind:this={chatWindow}
        class="px-4 py-0 overflow-y-auto space-y-2 scroll-container"
    >
        {#each $messageFeed as message}
            {#if message.messageFeedType === "look" || message.messageFeedType === "message"}
                <div class="flex flex-row text-left">
                    <div class="flex flex-col w-16 shrink-0">
                        <p class="italic text-sm">{message.name}</p>
                        <small class="opacity-50 text-xs"
                            >{getCurrentTimestamp(message.timestamp)}</small
                        >
                    </div>
                    {#if message.messageFeedType === "look"}
                        <!-- Look Message -->
                        <Look class="px-2"></Look>
                    {:else if message.messageFeedType === "message"}
                        <!-- Normal Messages -->
                        <p class="text-sm font-extralight px-2 text-left">
                            {message.message}
                        </p>
                    {/if}
                </div>
            {/if}
        {/each}
    </section>

    <div class="m-0 px-4 h-4 shrink-0">
        {#if systemMessage}
            <p class="text-sm text-left text-destructive">
                {systemMessage.message}
            </p>
        {/if}
    </div>
</div>

<!-- Styles -->
<style>
    /* Hide Scrollbar */
    .scroll-container {
        overflow-x: auto;
        scrollbar-width: none; /* Firefox */
        -ms-overflow-style: none; /* Internet Explorer 10+ */
    }
    .scroll-container::-webkit-scrollbar {
        display: none; /* WebKit */
    }
</style>
