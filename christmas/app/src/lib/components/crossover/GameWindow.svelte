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

    const lorem =
        "Ab natus quis quia. Quae dolore deserunt at vitae beatae eligendi facilis nam. Quam error quis facere libero id necessitatibus.";

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
                },
                {
                    key: "shout",
                    label: "Shout",
                    icon: MessageSquare,
                    shortcut: null,
                },
                {
                    key: "whisper",
                    label: "Whisper",
                    icon: MessageSquare,
                    shortcut: null,
                },
            ],
        ],
        // Combat
        [
            { key: "combat", label: "Combat" },
            [
                { key: "punch", label: "Punch", icon: Grab, shortcut: "⌘P" },
                { key: "flee", label: "Flee", icon: ArrowLeft, shortcut: "⌘F" },
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

    let messageFeed: MessageFeed[] = [
        {
            id: 0,
            host: true,
            avatar: null,
            name: "Jane",
            timestamp: "Yesterday @ 2:30pm",
            message: lorem,
            color: "variant-soft-primary",
        },
        {
            id: 1,
            host: false,
            avatar: null,
            name: "Michael",
            timestamp: "Yesterday @ 2:45pm",
            message: lorem,
            color: "variant-soft-primary",
        },
        {
            id: 2,
            host: true,
            avatar: null,
            name: "Jane",
            timestamp: "Yesterday @ 2:50pm",
            message: lorem,
            color: "variant-soft-primary",
        },
        {
            id: 3,
            host: false,
            avatar: null,
            name: "Michael",
            timestamp: "Yesterday @ 2:52pm",
            message: lorem,
            color: "variant-soft-primary",
        },
    ];

    async function onChatMessage(command: ChatCommand | null, message: string) {
        console.log(command, message);

        // Send the message to the server
        const response = await fetch("/api/crossover/cmd/say", {
            method: "POST",
            body: JSON.stringify({ message: "hello" }),
            headers: {
                "Content-Type": "application/json",
            },
        });

        console.log(await response.json());

        const newMessage = {
            id: messageFeed.length,
            host: true,
            avatar: null,
            name: "Jane",
            timestamp: `Today @ ${getCurrentTimestamp()}`,
            message: message,
            color: "variant-soft-primary",
        };
        // Update the message feed
        messageFeed = [...messageFeed, newMessage];
    }

    function getCurrentTimestamp(): string {
        return new Date().toLocaleString("en-US", {
            hour: "numeric",
            minute: "numeric",
            hour12: true,
        });
    }
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
