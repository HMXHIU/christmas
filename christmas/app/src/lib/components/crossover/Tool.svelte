<script lang="ts">
    import * as Tabs from "$lib/components/ui/tabs";
    import { Box, Hammer, Scroll, Sword } from "lucide-svelte";
    import ScrollArea from "../ui/scroll-area/scroll-area.svelte";
    import Abilities from "./Abilities.svelte";
    import Actions from "./Actions.svelte";
    import Inventory from "./Inventory.svelte";
    import Quests from "./Quests.svelte";

    export let tool: "quests" | "inventory" | "abilities" | "actions" =
        "inventory";
</script>

<Tabs.Root value={tool}>
    <Tabs.List class="p-0">
        <Tabs.Trigger value="quests" class="h-full rounded-none"
            ><Scroll class="h-4 w-4" /></Tabs.Trigger
        >
        <Tabs.Trigger value="inventory" class="h-full rounded-none"
            ><Box class="h-4 w-4" /></Tabs.Trigger
        >
        <Tabs.Trigger value="abilities" class="h-full rounded-none"
            ><Sword class="h-4 w-4" /></Tabs.Trigger
        >
        <Tabs.Trigger value="actions" class="h-full rounded-none"
            ><Hammer class="h-4 w-4" /></Tabs.Trigger
        >
    </Tabs.List>
    <Tabs.Content value="quests" class="p-2"
        ><ScrollArea class="h-full">
            <Quests></Quests>
        </ScrollArea></Tabs.Content
    >
    <Tabs.Content value="inventory" class="p-2">
        <ScrollArea class="h-full">
            <Inventory></Inventory>
        </ScrollArea>
    </Tabs.Content>
    <Tabs.Content value="abilities" class="p-2"
        ><ScrollArea class="h-full">
            <Abilities></Abilities>
        </ScrollArea></Tabs.Content
    >
    <Tabs.Content value="actions" class="p-2"
        ><ScrollArea class="h-full">
            <Actions></Actions>
        </ScrollArea></Tabs.Content
    >
</Tabs.Root>
