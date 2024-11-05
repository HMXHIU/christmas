<script lang="ts">
    // Components
    import { Button } from "$lib/components/ui/button";
    import { cn } from "$lib/shadcn";
    import { debounce } from "lodash-es";
    import { Send } from "lucide-svelte";
    import Input from "../ui/input/input.svelte";
    import TargetSelect from "./TargetSelect.svelte";

    const showSendButton = false;

    export let onEnterKeyPress: (message: string) => void;
    export let onPartial: (message: string) => void;

    let message: string = "";

    const debouncedOnPartial = debounce(onPartial, 300, {
        leading: true,
        trailing: true,
    });

    $: debouncedOnPartial(message.trim());

    function onKeyDown(event: KeyboardEvent): void {
        if (["Enter"].includes(event.code)) {
            onSubmit();
        }
        // Disable arrow up/down key scrolling (reserve for AutocompleteGC)
        else if (["ArrowUp", "ArrowDown"].includes(event.code)) {
            event.preventDefault();
        }
    }

    function onSubmit(): void {
        onEnterKeyPress(message);
        message = ""; // clear message on Enter/Submit
    }
</script>

<section
    class={cn(
        "flex flex-row border border-foreground-muted rounded-md",
        $$restProps.class,
    )}
>
    <!-- Target Select -->
    <TargetSelect
        class="h-10 border-0 text-muted-foreground my-auto rounded-r-none"
    ></TargetSelect>
    <!-- Chat Input -->
    <Input
        type="text"
        id="prompt"
        class="h-10 bg-transparent ring-0 border-0 border-l rounded-none "
        bind:value={message}
        on:keydown={onKeyDown}
        autocomplete="off"
    />
    {#if showSendButton}
        <!-- Send Button -->
        <Button
            variant="ghost"
            on:click={onSubmit}
            class="h-full my-autoborder-0 text-muted-foreground"
        >
            <Send />
        </Button>
    {/if}
</section>
