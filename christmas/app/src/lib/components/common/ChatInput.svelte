<script lang="ts">
    // Components
    import { Button } from "$lib/components/ui/button";
    import { Textarea } from "$lib/components/ui/textarea";
    import { cn } from "$lib/shadcn";
    import { Send } from "lucide-svelte";
    import ChatCommandSelect from "./ChatCommandSelect.svelte";
    import type { ChatCommandGroupUI, ChatCommandUI } from "./types";

    export let defaultCommand: string;
    export let commandGroups: [ChatCommandGroupUI, ChatCommandUI[]][];
    export let onChatMessage: (
        command: ChatCommandUI | null,
        message: string,
    ) => void;

    let command: ChatCommandUI | null = null;
    let message: string = "";

    function onPromptKeydown(event: KeyboardEvent): void {
        if (["Enter"].includes(event.code)) {
            event.preventDefault();
            onSubmit();
        }
    }

    function onSubmit(): void {
        onChatMessage(command, message);
        message = "";
    }
</script>

<section
    class={cn(
        "flex flex-row border border-foreground-muted rounded-md",
        $$restProps.class,
    )}
>
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
        placeholder={command?.description ?? "Speak friend..."}
        rows={1}
        on:keydown={onPromptKeydown}
    />
    <Button variant="ghost" on:click={onSubmit} class="my-auto h-full border-0">
        <Send />
    </Button>
</section>
