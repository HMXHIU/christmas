<script lang="ts">
    import Chat from "$lib/components/common/Chat.svelte";
    import type {
        ChatCommandGroupUI,
        ChatCommandUI,
        MessageFeedUI,
    } from "$lib/components/common/types";
    import type { Player } from "$lib/server/crossover/redis/entities";
    import type { TileSchema } from "$lib/server/crossover/router";
    import { cn } from "$lib/shadcn";
    import {
        ArrowLeft,
        Eye,
        FlameKindling,
        Grab,
        MessageSquare,
    } from "lucide-svelte";
    import { z } from "zod";
    import ContextSection from "./ContextSection.svelte";

    export let players: Player[] = [];
    export let tile: z.infer<typeof TileSchema> = {
        tile: "The Abyss",
        description: "You are nowhere to be found.",
    };

    export let messageFeed: MessageFeedUI[] = [];
    export let onChatMessage: (
        command: ChatCommandUI | null,
        message: string,
    ) => void;

    let defaultCommand = "say";
    let commandGroups: [ChatCommandGroupUI, ChatCommandUI[]][] = [
        // Speech
        [
            { key: "speech", label: "Speech" },
            [
                {
                    key: "say",
                    label: "Say",
                    icon: MessageSquare,
                    shortcut: "⌘S",
                    description: "Say something to everyone in the room.",
                },
                {
                    key: "shout",
                    label: "Shout",
                    icon: MessageSquare,
                    shortcut: null,
                    description: "Shout something to everyone in the area.",
                },
                {
                    key: "whisper",
                    label: "Whisper",
                    icon: MessageSquare,
                    shortcut: null,
                    description: "Whisper something to someone.",
                },
            ],
        ],
        // Combat
        [
            { key: "combat", label: "Combat" },
            [
                {
                    key: "punch",
                    label: "Punch",
                    icon: Grab,
                    shortcut: "⌘P",
                    description: "Punch someone.",
                },
                {
                    key: "flee",
                    label: "Flee",
                    icon: ArrowLeft,
                    shortcut: "⌘F",
                    description: "Flee from combat.",
                },
            ],
        ],
        // Out of Combat (OOC)
        [
            { key: "ooc", label: "Out of Combat (OOC)" },
            [
                {
                    key: "look",
                    label: "Look",
                    icon: Eye,
                    shortcut: "⌘L",
                    description: "Look at something.",
                },
                {
                    key: "rest",
                    label: "Rest",
                    icon: FlameKindling,
                    shortcut: "⌘R",
                    description: "Rest and recover.",
                },
            ],
        ],
    ];
</script>

<div class={cn("w-full flex flex-col", $$restProps.class)}>
    <!-- Chat -->
    <Chat
        {messageFeed}
        {onChatMessage}
        {commandGroups}
        {defaultCommand}
        class="h-3/5"
    ></Chat>
    <!-- Context Section -->
    <ContextSection {players} {tile} class="h-2/5 pt-2"></ContextSection>
</div>
