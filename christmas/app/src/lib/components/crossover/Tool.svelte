<script lang="ts">
    import * as Tabs from "$lib/components/ui/tabs";
    import { Box } from "lucide-svelte";
    import ScrollArea from "../ui/scroll-area/scroll-area.svelte";
    import Abilities from "./Abilities.svelte";
    import Actions from "./Actions.svelte";
    import Inventory from "./Inventory.svelte";

    export let tool: "inventory" | "abilities" | "actions" = "inventory";
</script>

<Tabs.Root value={tool} orientation="vertical" class="w-full flex flex-row">
    <Tabs.List class="flex flex-col h-full w-8 p-0">
        <Tabs.Trigger value="inventory" class="h-8"
            ><Box class="h-4 w-4" /></Tabs.Trigger
        >
        <Tabs.Trigger value="abilities" class="h-8"
            ><Box class="h-4 w-4" /></Tabs.Trigger
        >
        <Tabs.Trigger value="actions" class="h-8"
            ><Box class="h-4 w-4" /></Tabs.Trigger
        >
    </Tabs.List>
    <div class="flex-grow">
        <Tabs.Content value="inventory">
            <ScrollArea orientation="vertical" class="h-full">
                <Inventory></Inventory>
            </ScrollArea>
        </Tabs.Content>
        <Tabs.Content value="abilities"
            ><ScrollArea orientation="vertical" class="h-full">
                <Abilities></Abilities>
            </ScrollArea></Tabs.Content
        >
        <Tabs.Content value="actions"
            ><ScrollArea orientation="vertical" class="h-full">
                <Actions></Actions>
            </ScrollArea></Tabs.Content
        >
    </div>
</Tabs.Root>
