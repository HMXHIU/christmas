<script lang="ts">
    import CalendarIcon from "lucide-svelte/icons/calendar";
    import { Calendar } from "$lib/components/ui/calendar";
    import * as Popover from "$lib/components/ui/popover";
    import { Button } from "$lib/components/ui/button";
    import { cn } from "$lib/shadcn";

    import {
        type DateValue,
        DateFormatter,
        getLocalTimeZone,
    } from "@internationalized/date";

    export let value: DateValue | undefined = undefined;

    const df = new DateFormatter("en-US", {
        dateStyle: "long",
    });
</script>

<Popover.Root>
    <Popover.Trigger asChild let:builder>
        <Button
            variant="outline"
            class={cn(
                "justify-start text-left font-normal",
                !value && "text-muted-foreground",
            )}
            builders={[builder]}
        >
            <CalendarIcon class="mr-2 h-4 w-4" />
            {value
                ? df.format(value.toDate(getLocalTimeZone()))
                : "Pick a date"}
        </Button>
    </Popover.Trigger>
    <Popover.Content class="w-auto p-0">
        <Calendar bind:value initialFocus />
    </Popover.Content>
</Popover.Root>
