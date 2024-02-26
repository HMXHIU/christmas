<script lang="ts">
    // Components
    import { Avatar } from "@skeletonlabs/skeleton";
    import { onMount } from "svelte";
    import { Textarea } from "$lib/components/ui/textarea";
    import { MessageSquare, Grab, FlameKindling, Send } from "lucide-svelte";
    import * as Command from "$lib/components/ui/command";
    import * as Popover from "$lib/components/ui/popover";
    import ChatCommand from "./crossover/ChatCommand.svelte";
    import { Button } from "$lib/components/ui/button";
    import ChatWindow from "./ChatWindow.svelte";

    // Types
    interface Person {
        id: number;
        avatar: number;
        name: string;
    }
    interface MessageFeed {
        id: number;
        host: boolean;
        avatar: number;
        name: string;
        timestamp: string;
        message: string;
        color: string;
    }

    let elemChat: HTMLElement;
    const lorem =
        "Ab natus quis quia. Quae dolore deserunt at vitae beatae eligendi facilis nam. Quam error quis facere libero id necessitatibus.";

    // Navigation List
    const people: Person[] = [
        { id: 0, avatar: 14, name: "Michael" },
        { id: 1, avatar: 40, name: "Janet" },
        { id: 2, avatar: 31, name: "Susan" },
        { id: 3, avatar: 56, name: "Joey" },
        { id: 4, avatar: 24, name: "Lara" },
        { id: 5, avatar: 9, name: "Melissa" },
    ];
    let currentPersonId: number = people[0].id;

    // Messages
    let messageFeed: MessageFeed[] = [
        {
            id: 0,
            host: true,
            avatar: 48,
            name: "Jane",
            timestamp: "Yesterday @ 2:30pm",
            message: lorem,
            color: "variant-soft-primary",
        },
        {
            id: 1,
            host: false,
            avatar: 14,
            name: "Michael",
            timestamp: "Yesterday @ 2:45pm",
            message: lorem,
            color: "variant-soft-primary",
        },
        {
            id: 2,
            host: true,
            avatar: 48,
            name: "Jane",
            timestamp: "Yesterday @ 2:50pm",
            message: lorem,
            color: "variant-soft-primary",
        },
        {
            id: 3,
            host: false,
            avatar: 14,
            name: "Michael",
            timestamp: "Yesterday @ 2:52pm",
            message: lorem,
            color: "variant-soft-primary",
        },
    ];
    let currentMessage = "";

    function getCurrentTimestamp(): string {
        return new Date().toLocaleString("en-US", {
            hour: "numeric",
            minute: "numeric",
            hour12: true,
        });
    }

    async function addMessage() {
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
            avatar: 48,
            name: "Jane",
            timestamp: `Today @ ${getCurrentTimestamp()}`,
            message: currentMessage,
            color: "variant-soft-primary",
        };
        // Update the message feed
        messageFeed = [...messageFeed, newMessage];
        // Clear prompt
        currentMessage = "";
    }

    function onPromptKeydown(event: KeyboardEvent): void {
        if (["Enter"].includes(event.code)) {
            event.preventDefault();
            addMessage();
        }
    }
</script>

<section class="card">
    <div class="chat w-full h-full grid grid-cols-1 lg:grid-cols-[30%_1fr]">
        <!-- Navigation -->
        <div
            class="hidden lg:grid grid-rows-[auto_1fr_auto] border-r border-surface-500/30"
        >
            <!-- Header -->
            <header class="border-b border-surface-500/30 p-4">
                <input class="input" type="search" placeholder="Search..." />
            </header>
            <!-- List -->
            <div class="p-4 space-y-4 overflow-y-auto">
                <small class="opacity-50">Contacts</small>
                <div class="flex flex-col space-y-1">
                    {#each people as person}
                        <button
                            type="button"
                            class="btn w-full flex items-center space-x-4 {person.id ===
                            currentPersonId
                                ? 'variant-filled-primary'
                                : 'bg-surface-hover-token'}"
                            on:click={() => (currentPersonId = person.id)}
                        >
                            <Avatar
                                src="https://i.pravatar.cc/?img={person.avatar}"
                                width="w-8"
                            />
                            <span class="flex-1 text-start">
                                {person.name}
                            </span>
                        </button>
                    {/each}
                </div>
            </div>
            <!-- Footer -->
            <!-- <footer class="border-t border-surface-500/30 p-4">(footer)</footer> -->
        </div>
        <!-- Chat -->
        <div class="grid grid-row-[1fr_auto]">
            <ChatWindow {messageFeed}></ChatWindow>

            <!-- Prompt -->
            <section
                class="flex flex-row border border-foreground-muted rounded-md m-4"
            >
                <ChatCommand class="h-full border-0 text-muted-foreground"
                ></ChatCommand>
                <Textarea
                    bind:value={currentMessage}
                    class="bg-transparent ring-0 border-0 border-l border-r rounded-none"
                    name="prompt"
                    id="prompt"
                    placeholder="Write a message..."
                    rows={1}
                    on:keydown={onPromptKeydown}
                />
                <Button
                    variant="ghost"
                    on:click={addMessage}
                    class="my-auto h-full border-0"
                >
                    <Send />
                </Button>
            </section>
        </div>
    </div>
</section>
