<script lang="ts">
    import { cn } from "$lib/shadcn";
    import { getCurrentTimestamp } from "$lib/utils";
    import gsap from "gsap";
    import { messageFeed } from "../../../store";
    import { type MessageFeed, type MessageFeedType } from "./GameWindow";
    import InteractiveText from "./InteractiveText.svelte";

    let chatWindow: HTMLElement;

    export let messageFilter: MessageFeedType[] = [
        "message",
        "error",
        "system",
        "combat",
    ];

    $: messages = $messageFeed.filter((m) =>
        messageFilter.includes(m.messageFeedType),
    );
    $: scrollToBottom(messages);

    const scrollToBottom = (ms: MessageFeed[]) => {
        if (chatWindow) {
            gsap.to(chatWindow, {
                duration: 0.7,
                scrollTop: chatWindow.scrollHeight,
                ease: "power2.out",
            });
        }
    };
</script>

<div
    class={cn("h-full w-full flex flex-col justify-between", $$restProps.class)}
>
    <section
        bind:this={chatWindow}
        class="p-0 space-y-2 h-full scroll-container"
    >
        {#each messages as message}
            <div class="flex flex-row text-left">
                {#if message.messageFeedType === "message" || message.messageFeedType === "combat"}
                    <!-- Normal Messages -->
                    <p class="text-xs font-extralight text-left">
                        <!-- Bubble up `entityLink` events -->
                        <InteractiveText text={message.message} on:entityLink
                        ></InteractiveText>
                    </p>
                {:else if message.messageFeedType === "error"}
                    <!-- Error Messages -->
                    <p class="text-xs font-extralight text-left text-rose-400">
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
                    <p class="text-xs font-extralight text-left">
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
        overflow-y: auto;
        scrollbar-width: none; /* Firefox */
        -ms-overflow-style: none; /* Internet Explorer 10+ */
    }
    .scroll-container::-webkit-scrollbar {
        overflow-y: auto;
        display: none; /* WebKit */
    }
</style>
