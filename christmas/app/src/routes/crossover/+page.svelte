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

    let messageFeed: MessageFeedUI[] = [];
    let eventStream: EventTarget | null = null;
    let closeStream: (() => void) | null = null;

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
        const { cmd, origin, message } = (event as MessageEvent).data;

        switch (cmd) {
            case "say":
                messageFeed = [
                    ...messageFeed,
                    {
                        id: messageFeed.length,
                        timestamp: getCurrentTimestamp(),
                        message: `${origin} says '${message}'`,
                        name: "",
                    },
                ];
                break;

            default:
                break;
        }
    }

    async function startStream() {
        [eventStream, closeStream] = await stream();
        eventStream.addEventListener("message", processMessageEvent);
    }

    function stopStream() {
        if (eventStream != null) {
            eventStream.removeEventListener("message", processMessageEvent);
        }
        if (closeStream != null) {
            closeStream();
        }
    }

    onMount(() => {
        // Start streaming crossover server events on login
        const unsubscribe = player.subscribe(async (p) => {
            if (p != null) {
                stopStream();
                await startStream();
            } else {
                stopStream();
            }
        });

        return () => {
            stopStream();
            unsubscribe();
        };
    });
</script>

{#if !$player}
    <Onboard />
{:else}
    <GameWindow class="h-full" {onChatMessage} {messageFeed} />
{/if}
