<script lang="ts">
    import * as Card from "$lib/components/ui/card/index.js";
    import { Label } from "$lib/components/ui/label/index.js";
    import {
        EquipmentSlots,
        type EquipmentSlot,
    } from "$lib/crossover/world/compendium";
    import type { Item } from "$lib/server/crossover/redis/entities";
    import { cn } from "$lib/shadcn";
    import { onMount } from "svelte";
    import { itemRecord, player } from "../../../store";

    let inventoryItems: Item[] = [];
    let equippedItems: Item[] = [];

    onMount(() => {
        const unsubscribe = itemRecord.subscribe((ir) => {
            const playerItems = Object.values(ir).filter((item) => {
                return item.loc.length === 1 && item.loc[0] === $player?.player;
            });
            inventoryItems = playerItems.filter((item) => {
                return item.locT === "inv";
            });
            equippedItems = playerItems.filter((item) => {
                return EquipmentSlots.includes(item.locT as EquipmentSlot);
            });
        });
        return unsubscribe;
    });
</script>

<div class={cn("w-full", $$restProps.class)}>
    <Card.Root class="border-none">
        <Card.Header>
            <Card.Title>Inventory</Card.Title>
        </Card.Header>
        <Card.Content class="space-y-2">
            <div class="space-y-1">
                <Label for="current">Equipped</Label>
                <div class="text-xs">
                    {#if equippedItems.length > 0}
                        {#each equippedItems as item (item.item)}
                            <p>{item.name} ({item.item})</p>
                        {/each}
                    {:else}
                        <p>Nothing equipped</p>
                    {/if}
                </div>
            </div>
            <div class="space-y-1">
                <Label for="new">Bag</Label>
                <div class="text-xs">
                    {#if inventoryItems.length > 0}
                        {#each inventoryItems as item (item.item)}
                            <p>{item.name} ({item.item})</p>
                        {/each}
                    {:else}
                        <p>Nothing in your bag</p>
                    {/if}
                </div>
            </div>
        </Card.Content>
    </Card.Root>
</div>
