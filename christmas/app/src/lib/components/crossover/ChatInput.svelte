<script lang="ts">
    // Components
    import { Button } from "$lib/components/ui/button";
    import { Textarea } from "$lib/components/ui/textarea";
    import { cn } from "$lib/shadcn";
    import { debounce } from "lodash";
    import { Send } from "lucide-svelte";
    import TargetSelect from "./TargetSelect.svelte";

    export let onEnter: (message: string) => void;
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
    }

    function onSubmit(): void {
        onEnter(message);
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
    <TargetSelect class="h-full border-0 text-muted-foreground"></TargetSelect>
    <!-- Chat Input -->
    <Textarea
        bind:value={message}
        class="bg-transparent ring-0 border-0 border-l border-r rounded-none min-h-[60px]"
        name="prompt"
        id="prompt"
        rows={1}
        on:keydown={onKeyDown}
    />
    <!-- Send Button -->
    <Button
        variant="ghost"
        on:click={onSubmit}
        class="h-full my-autoborder-0 text-muted-foreground"
    >
        <Send />
    </Button>
</section>
