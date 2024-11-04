<script lang="ts">
    import { cn } from "$lib/shadcn";
    import { getCurrentTimestamp } from "$lib/utils";
    import { messageFeed } from "../../../store";
    import type { MessageFeedType } from "./GameWindow";
    import InteractiveText from "./InteractiveText.svelte";

    let chatWindow: HTMLElement;

    export let messageFilter: MessageFeedType[] = [
        "message",
        "error",
        "system",
        "combat",
    ];
</script>

<div
    class={cn("h-full w-full flex flex-col justify-between", $$restProps.class)}
>
    <section
        bind:this={chatWindow}
        class="px-4 py-0 overflow-y-auto space-y-2 scroll-container"
    >
        {#each $messageFeed.filter( (m) => messageFilter.includes(m.messageFeedType), ) as message}
            <div class="flex flex-row text-left">
                {#if message.messageFeedType === "message" || message.messageFeedType === "combat"}
                    <!-- Normal Messages -->
                    <p class="text-xs font-extralight px-2 text-left">
                        <!-- Bubble up `entityLink` events -->
                        <InteractiveText text={message.message} on:entityLink
                        ></InteractiveText>
                    </p>
                {:else if message.messageFeedType === "error"}
                    <!-- Error Messages -->
                    <p
                        class="text-xs font-extralight px-2 text-left text-destructive"
                    >
                        {message.message}
                    </p>
                {:else if message.messageFeedType === "system"}
                    <!-- System Messages -->
                    <div class="flex flex-col w-16 shrink-0">
                        <!-- Show time on system messages -->
                        <small class="opacity-50 text-xs"
                            >{getCurrentTimestamp(message.timestamp)}</small
                        >
                        <p class="opacity-50 text-xs">{message.name}</p>
                    </div>
                    <p class="text-xs font-extralight px-2 text-left">
                        {message.message}
                    </p>
                {/if}
            </div>
        {/each}
    </section>
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
