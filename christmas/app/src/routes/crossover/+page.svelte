<script lang="ts">
    import GameWindow from "$lib/components/crossover/GameWindow.svelte";
    import Onboard from "$lib/components/crossover/Onboard.svelte";
    import { stream } from "$lib/crossover";

    import type {
        ChatCommandUI,
        MessageFeedUI,
    } from "$lib/components/common/types";
    import { trpc } from "$lib/trpcClient";
    import { onMount } from "svelte";
    import { player } from "../../store";

    let MessageFeedUI: MessageFeedUI[] = [];

    async function onChatMessage(
        command: ChatCommandUI | null,
        message: string,
    ) {
        switch (command?.key) {
            case "say":
                await trpc().crossover.cmd.say.query({ message });
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
                MessageFeedUI = [
                    ...MessageFeedUI,
                    {
                        id: MessageFeedUI.length,
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
    <GameWindow class="h-full" {onChatMessage} {MessageFeedUI} />
{/if}
