<script lang="ts">
    import type {
        ChatCommand,
        Entity,
        MessageFeed,
    } from "$lib/crossover/types";
    import Chat from "../Chat.svelte";
    import ContextSection from "./ContextSection.svelte";

    const lorem =
        "Ab natus quis quia. Quae dolore deserunt at vitae beatae eligendi facilis nam. Quam error quis facere libero id necessitatibus.";

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

<!-- Chat -->
<Chat {messageFeed} {onChatMessage}></Chat>
<!-- Context -->
<ContextSection {entities}></ContextSection>
