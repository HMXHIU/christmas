<script lang="ts">
    import { onMount } from "svelte";
    import type { MessageFeed } from "$lib/crossover/types";

    let chatWindow: HTMLElement;

    export let messageFeed: MessageFeed[] = [];

    function scrollChatBottom(behavior?: ScrollBehavior): void {
        chatWindow?.scrollTo({ top: chatWindow.scrollHeight, behavior });
    }

    onMount(() => {
        scrollChatBottom();
    });

    function onNewMessages(messages: MessageFeed[]): void {
        setTimeout(() => {
            scrollChatBottom("smooth");
        }, 0);
    }

    $: onNewMessages(messageFeed);
</script>

<section
    bind:this={chatWindow}
    class="max-h-[500px] p-4 overflow-y-auto space-y-2"
>
    {#each messageFeed as message}
        <div class="flex flex-row text-left">
            <div class="flex flex-col w-16 shrink-0">
                <p class="italic text-sm">{message.name}</p>
                <small class="opacity-50 text-xs">{message.timestamp}</small>
            </div>
            <p class="text-sm font-extralight px-2 text-left">
                {message.message}
            </p>
        </div>
    {/each}
</section>
