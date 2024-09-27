<script lang="ts">
    import * as Tabs from "$lib/components/ui/tabs";
    import { Box, Hammer, Sword } from "lucide-svelte";
    import ScrollArea from "../ui/scroll-area/scroll-area.svelte";
    import Abilities from "./Abilities.svelte";
    import Actions from "./Actions.svelte";
    import Inventory from "./Inventory.svelte";

    export let tool: "inventory" | "abilities" | "actions" = "inventory";
</script>

<Tabs.Root value={tool}>
    <Tabs.List>
        <Tabs.Trigger value="inventory" class="h-9"
            ><Box class="h-4 w-4" /></Tabs.Trigger
        >
        <Tabs.Trigger value="abilities" class="h-9"
            ><Sword class="h-4 w-4" /></Tabs.Trigger
        >
        <Tabs.Trigger value="actions" class="h-9"
            ><Hammer class="h-4 w-4" /></Tabs.Trigger
        >
    </Tabs.List>

    <Tabs.Content value="inventory">
        <ScrollArea class="h-full">
            <Inventory></Inventory>
        </ScrollArea>
    </Tabs.Content>
    <Tabs.Content value="abilities"
        ><ScrollArea class="h-full">
            <Abilities></Abilities>
        </ScrollArea></Tabs.Content
    >
    <Tabs.Content value="actions"
        ><ScrollArea class="h-full">
            <Actions></Actions>
        </ScrollArea></Tabs.Content
    >
</Tabs.Root>
