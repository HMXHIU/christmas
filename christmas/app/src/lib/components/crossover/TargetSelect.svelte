<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import * as Command from "$lib/components/ui/command";
    import * as Popover from "$lib/components/ui/popover";
    import type { Actor } from "$lib/crossover/types";
    import { sameLocation } from "$lib/crossover/utils";
    import { cn } from "$lib/shadcn";
    import { Crosshair } from "lucide-svelte";
    import { tick } from "svelte";
    import {
        itemRecord,
        monsterRecord,
        player,
        playerRecord,
        target,
    } from "../../../store";

    let open = false;

    function sameLocationAsPlayer(entity: Actor): boolean {
        return $player != null && sameLocation(entity, $player);
    }

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
            {#if $target}
                <span>{$target.name || ""}</span>
            {/if}
        </Button>
    </Popover.Trigger>
    <Popover.Content class="w-96 p-0" align="start">
        <Command.Root class="max-w-96 rounded-lg border shadow-md">
            <Command.Input placeholder="Search Targets..." />
            <Command.List>
                <!-- Players -->
                {#if Object.keys($playerRecord).length > 0}
                    <Command.Group heading="Players">
                        {#each Object.values($playerRecord).filter(sameLocationAsPlayer) as player (player.player)}
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
                {#if Object.keys($monsterRecord).length > 0}
                    <Command.Group heading="Monsters">
                        {#each Object.values($monsterRecord).filter(sameLocationAsPlayer) as monster (monster.monster)}
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
                {#if Object.keys($itemRecord).length > 0}
                    <Command.Group heading="Items">
                        {#each Object.values($itemRecord).filter(sameLocationAsPlayer) as item (item.item)}
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
