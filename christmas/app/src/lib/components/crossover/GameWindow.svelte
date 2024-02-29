<script lang="ts">
    import type {
        ChatCommand,
        ChatCommandGroup,
        Entity,
        MessageFeed,
    } from "$lib/crossover/types";
    import {
        MessageSquare,
        Grab,
        FlameKindling,
        ArrowLeft,
    } from "lucide-svelte";
    import Chat from "../Chat.svelte";
    import ContextSection from "./ContextSection.svelte";
    import { cn } from "$lib/shadcn";

    export let messageFeed: MessageFeed[] = [];
    export let onChatMessage: (
        command: ChatCommand | null,
        message: string,
    ) => void;

    let defaultCommand = "say";
    let commandGroups: [ChatCommandGroup, ChatCommand[]][] = [
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

    let entities: Entity[] = [
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
    <ContextSection {entities} class="h-2/5"></ContextSection>
</div>
