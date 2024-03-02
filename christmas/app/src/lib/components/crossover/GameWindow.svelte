<script lang="ts">
    import Chat from "$lib/components/common/Chat.svelte";
    import type {
        ChatCommandGroupUI,
        ChatCommandUI,
        MessageFeedUI,
    } from "$lib/components/common/types";
    import { cn } from "$lib/shadcn";
    import {
        ArrowLeft,
        FlameKindling,
        Grab,
        MessageSquare,
    } from "lucide-svelte";
    import ContextSection from "./ContextSection.svelte";
    import type { AgentUI } from "./types";

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
                    key: "rest",
                    label: "Rest",
                    icon: FlameKindling,
                    shortcut: "⌘R",
                    description: "Rest and recover.",
                },
            ],
        ],
    ];

    let agents: AgentUI[] = [
        { id: 0, avatar: null, name: "Michael" },
        { id: 1, avatar: null, name: "Janet" },
        { id: 2, avatar: null, name: "Susan" },
        { id: 3, avatar: null, name: "Joey" },
        { id: 4, avatar: null, name: "Lara" },
        { id: 5, avatar: null, name: "Melissa" },
    ];
</script>

<div class={cn("flex flex-col", $$restProps.class)}>
    <!-- Chat -->
    <Chat
        {messageFeed}
        {onChatMessage}
        {commandGroups}
        {defaultCommand}
        class="h-3/5"
    ></Chat>
    <!-- Context Section -->
    <ContextSection {agents} class="h-2/5"></ContextSection>
</div>
