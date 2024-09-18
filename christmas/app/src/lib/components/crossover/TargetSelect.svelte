<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import * as Command from "$lib/components/ui/command";
    import * as Popover from "$lib/components/ui/popover";
    import type { Item, Monster, Player } from "$lib/crossover/types";
    import { cn } from "$lib/shadcn";
    import { Crosshair } from "lucide-svelte";
    import { onMount, tick } from "svelte";
    import {
        itemRecord,
        monsterRecord,
        playerRecord,
        target,
    } from "../../../store";

    let open = false;
    let monsters: Monster[] = [];
    let players: Player[] = [];
    let items: Item[] = [];

    function closeAndFocusTrigger(triggerId: string) {
        open = false;
        tick().then(() => {
            document.getElementById(triggerId)?.focus();
        });
    }

    onMount(() => {
        const unsubscribeItems = itemRecord.subscribe((value) => {
            items = Object.values(value);
        });
        const unsubscribeMonsters = monsterRecord.subscribe((value) => {
            monsters = Object.values(value);
        });
        const unsubscribePlayers = playerRecord.subscribe((value) => {
            players = Object.values(value);
        });

        return () => {
            unsubscribeItems();
            unsubscribeMonsters();
            unsubscribePlayers();
        };
    });
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
            {#if $target}
                <span>{$target.name || ""}</span>
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
                                    target.set(player);
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
                                    target.set(monster);
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
                                    target.set(item);
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
