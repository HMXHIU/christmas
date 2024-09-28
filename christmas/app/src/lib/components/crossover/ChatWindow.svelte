<script lang="ts">
    import { cn } from "$lib/shadcn";
    import { getCurrentTimestamp } from "$lib/utils";
    import { messageFeed } from "../../../store";

    let chatWindow: HTMLElement;
</script>

<div
    class={cn("h-full w-full flex flex-col justify-between", $$restProps.class)}
>
    <section
        bind:this={chatWindow}
        class="px-4 py-0 overflow-y-auto space-y-2 scroll-container"
    >
        {#each $messageFeed as message}
            <div class="flex flex-row text-left">
                <div class="flex flex-col w-16 shrink-0">
                    <small class="opacity-50 text-xs"
                        >{getCurrentTimestamp(message.timestamp)}</small
                    >
                    <p class="opacity-50 text-xs">{message.name}</p>
                </div>
                {#if message.messageFeedType === "message"}
                    <!-- Normal Messages -->
                    <p class="text-sm font-extralight px-2 text-left">
                        {message.message}
                    </p>
                {:else if message.messageFeedType === "error"}
                    <!-- Error Messages -->
                    <p
                        class="text-sm font-extralight px-2 text-left text-destructive"
                    >
                        {message.message}
                    </p>
                {:else if message.messageFeedType === "system"}
                    <!-- System Messages -->
                    <p class="text-sm font-extralight px-2 text-left">
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
