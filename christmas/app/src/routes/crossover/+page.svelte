<script lang="ts">
    import GameWindow from "$lib/components/crossover/GameWindow.svelte";
    import Onboard from "$lib/components/crossover/Onboard.svelte";
    import { commandLook, commandSay, stream } from "$lib/crossover";

    import type {
        ChatCommandUI,
        MessageFeedUI,
    } from "$lib/components/common/types";
    import { abyssTile } from "$lib/crossover/world/resources";
    import type { Player } from "$lib/server/crossover/redis/entities";
    import type { TileSchema } from "$lib/server/crossover/router";
    import { substituteVariables } from "$lib/utils";
    import { onMount } from "svelte";
    import type { z } from "zod";
    import { player } from "../../store";
    import type { MessageEventData } from "../api/crossover/stream/+server";

    let messageFeed: MessageFeedUI[] = [];
    let eventStream: EventTarget | null = null;
    let closeStream: (() => void) | null = null;

    let tile: z.infer<typeof TileSchema> = abyssTile;
    let players: Player[] = [];

    async function onChatMessage(
        command: ChatCommandUI | null,
        message: string,
    ) {
        switch (command?.key) {
            case "say":
                await commandSay({ message });
                break;

            case "look":
                const lookResult = await commandLook({});
                players = lookResult.players;
                tile = lookResult.tile;
                console.log(JSON.stringify(players, null, 2));
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
        const { message, variables } = (event as MessageEvent)
            .data as MessageEventData;

        switch (variables.cmd) {
            case "say":
                messageFeed = [
                    ...messageFeed,
                    {
                        id: messageFeed.length,
                        timestamp: getCurrentTimestamp(),
                        message: substituteVariables(message, variables),
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
    <GameWindow
        class="h-full p-3"
        {onChatMessage}
        {messageFeed}
        {tile}
        {players}
    />
{/if}
