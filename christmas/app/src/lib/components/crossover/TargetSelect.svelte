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

    export let value: Player | Monster | Item | null = null;
    export let players: Player[] = [];
    export let monsters: Monster[] = [];
    export let items: Item[] = [];

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
                {#if players.length > 0}
                    <Command.Group heading="Players">
                        {#each players as player (player.player)}
                            <Command.Item
                                value={player.player}
                                onSelect={(selected) => {
                                    value = player;
                                    closeAndFocusTrigger(ids.trigger);
                                }}
                                class="flex flex-row justify-between"
                            >
                                <p>{player.name}</p>
                                <p class="text-muted-foreground">
                                    {player.player.slice(0, 7)}...
                                </p>
                            </Command.Item>
                        {/each}
                    </Command.Group>
                {/if}
                <!-- Monsters -->
                {#if monsters.length > 0}
                    <Command.Group heading="Monsters">
                        {#each monsters as monster (monster.monster)}
                            <Command.Item
                                value={monster.monster}
                                onSelect={(selected) => {
                                    value = monster;
                                    closeAndFocusTrigger(ids.trigger);
                                }}
                                class="flex flex-row justify-between"
                            >
                                <p>{monster.name}</p>
                                <p class="text-muted-foreground">
                                    {monster.monster}
                                </p>
                            </Command.Item>
                        {/each}
                    </Command.Group>
                {/if}
                <!-- Items -->
                {#if items.length > 0}
                    <Command.Group heading="Items">
                        {#each items as item (item.item)}
                            <Command.Item
                                value={item.item}
                                onSelect={(selected) => {
                                    value = item;
                                    closeAndFocusTrigger(ids.trigger);
                                }}
                                class="flex flex-row justify-between"
                            >
                                <p>{item.name}</p>
                                <p class="text-muted-foreground">
                                    {item.item}
                                </p>
                            </Command.Item>
                        {/each}
                    </Command.Group>
                {/if}
            </Command.List>
        </Command.Root>
    </Popover.Content>
</Popover.Root>
