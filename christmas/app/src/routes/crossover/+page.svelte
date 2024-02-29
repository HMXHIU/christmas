<script lang="ts">
    import GameWindow from "$lib/components/crossover/GameWindow.svelte";
    import Onboard from "$lib/components/crossover/Onboard.svelte";
    import type { ChatCommand, MessageFeed } from "$lib/crossover/types";
    import { trpc } from "$lib/trpc/client";
    import { player } from "../../store";

    let messageFeed: MessageFeed[] = [];

    async function onChatMessage(command: ChatCommand | null, message: string) {
        switch (command?.key) {
            case "say":
                await trpc().cmd.say.query({ message });
                break;

            default:
                console.warn("Unknown command:", command?.key, message);
                break;
        }
    }

    function getCurrentTimestamp(): string {
        return new Date().toLocaleString("en-US", {
            hour: "numeric",
            minute: "numeric",
            hour12: true,
        });
    }
</script>

{#if !$player}
    <Onboard />
{:else}
    <GameWindow class="h-full" {onChatMessage} {messageFeed} />
{/if}
