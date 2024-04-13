<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import * as Command from "$lib/components/ui/command";
    import * as Popover from "$lib/components/ui/popover";
    import type {
        Item,
        Monster,
        Player,
    } from "$lib/server/crossover/redis/entities";
    import { cn } from "$lib/shadcn";
    import { Crosshair } from "lucide-svelte";
    import { tick } from "svelte";
    import { itemRecord, monsterRecord, playerRecord } from "../../../store";

    export let value: Player | Monster | Item | null = null;

    let open = false;

    function closeAndFocusTrigger(triggerId: string) {
        open = false;
        tick().then(() => {
            document.getElementById(triggerId)?.focus();
        });
    }
</script>

<Popover.Root bind:open let:ids>
    <Popover.Trigger asChild let:builder>
        <Button
            builders={[builder]}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            class={cn("flex flex-row gap-2 p-2", $$restProps.class)}
        >
            <Crosshair></Crosshair>
            {#if value}
                <span>{value.name || ""}</span>
            {/if}
        </Button>
    </Popover.Trigger>
    <Popover.Content class="w-[325px] p-0">
        <Command.Root class="max-w-[325px] rounded-lg border shadow-md">
            <Command.Input placeholder="Search Targets..." />
            <Command.List>
                <!-- Players -->
                {#if Object.keys($playerRecord).length > 0}
                    <Command.Group heading="Players">
                        {#each Object.entries($playerRecord) as [playerId, player] (playerId)}
                            <Command.Item
                                value={playerId}
                                onSelect={(selected) => {
                                    value = player;
                                    closeAndFocusTrigger(ids.trigger);
                                }}
                                class="flex flex-row justify-between"
                            >
                                <p>{player.name}</p>
                                <p class="text-muted-foreground">
                                    {playerId.slice(0, 7)}...
                                </p>
                            </Command.Item>
                        {/each}
                    </Command.Group>
                {/if}
                <!-- Monsters -->
                {#if Object.keys($monsterRecord).length > 0}
                    <Command.Group heading="Monsters">
                        {#each Object.entries($monsterRecord) as [monsterId, monster] (monsterId)}
                            <Command.Item
                                value={monsterId}
                                onSelect={(selected) => {
                                    value = monster;
                                    closeAndFocusTrigger(ids.trigger);
                                }}
                                class="flex flex-row justify-between"
                            >
                                <p>{monster.name}</p>
                                <p class="text-muted-foreground">
                                    {monsterId}
                                </p>
                            </Command.Item>
                        {/each}
                    </Command.Group>
                {/if}
                <!-- Items -->
                {#if Object.keys($itemRecord).length > 0}
                    <Command.Group heading="Items">
                        {#each Object.entries($itemRecord) as [itemId, item] (itemId)}
                            <Command.Item
                                value={itemId}
                                onSelect={(selected) => {
                                    value = item;
                                    closeAndFocusTrigger(ids.trigger);
                                }}
                                class="flex flex-row justify-between"
                            >
                                <p>{item.name}</p>
                                <p class="text-muted-foreground">
                                    {itemId}
                                </p>
                            </Command.Item>
                        {/each}
                    </Command.Group>
                {/if}
            </Command.List>
        </Command.Root>
    </Popover.Content>
</Popover.Root>
