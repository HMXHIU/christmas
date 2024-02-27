<script lang="ts">
    // Components
    import { Textarea } from "$lib/components/ui/textarea";
    import { Send } from "lucide-svelte";
    import { Button } from "$lib/components/ui/button";
    import type { ChatCommand, ChatCommandGroup } from "$lib/crossover/types";
    import ChatCommandSelect from "./crossover/ChatCommandSelect.svelte";

    export let defaultCommand: string;
    export let commandGroups: [ChatCommandGroup, ChatCommand[]][];
    export let onChatMessage: (
        command: ChatCommand | null,
        message: string,
    ) => void;

    let command: ChatCommand | null = null;
    let message: string = "";

    function onPromptKeydown(event: KeyboardEvent): void {
        if (["Enter"].includes(event.code)) {
            event.preventDefault();
            onChatMessage(command, message);
        }
    }
</script>

<section class="flex flex-row border border-foreground-muted rounded-md m-4">
    <ChatCommandSelect
        bind:value={command}
        class="h-full border-0 text-muted-foreground"
        {commandGroups}
        {defaultCommand}
    />
    <Textarea
        bind:value={message}
        class="bg-transparent ring-0 border-0 border-l border-r rounded-none"
        name="prompt"
        id="prompt"
        placeholder="Write a message..."
        rows={1}
        on:keydown={onPromptKeydown}
    />
    <Button
        variant="ghost"
        on:click={() => {
            onChatMessage(command, message);
        }}
        class="my-auto h-full border-0"
    >
        <Send />
    </Button>
</section>
