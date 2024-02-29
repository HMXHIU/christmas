<script lang="ts">
    import GameWindow from "$lib/components/crossover/GameWindow.svelte";
    import Onboard from "$lib/components/crossover/Onboard.svelte";
    import type { ChatCommand, MessageFeed } from "$lib/crossover/types";
    import { trpc } from "$lib/trpc/client";
    import { onMount } from "svelte";
    import { player } from "../../store";
    import { stream } from "$lib/crossover";

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

    function processMessageEvent(event: Event) {
        const { cmd, origin, data } = (event as MessageEvent).data;
        switch (cmd) {
            case "say":
                messageFeed = [
                    ...messageFeed,
                    {
                        id: messageFeed.length,
                        timestamp: getCurrentTimestamp(),
                        message: `${origin} says '${data.message}'`,
                        name: "",
                    },
                ];
                break;

            default:
                break;
        }
    }

    onMount(() => {
        let eventStream: EventTarget | null = null;

        // Start streaming crossover server events on login
        const unsubscribePlayer = player.subscribe(async (value) => {
            eventStream = await stream();
            eventStream.addEventListener("message", processMessageEvent);
        });

        return () => {
            unsubscribePlayer();
            if (eventStream != null) {
                eventStream.removeEventListener("message", processMessageEvent);
            }
        };
    });
</script>

{#if !$player}
    <Onboard />
{:else}
    <GameWindow class="h-full" {onChatMessage} {messageFeed} />
{/if}
