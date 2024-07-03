<script lang="ts">
    import * as Card from "$lib/components/ui/card/index.js";
    import { Label } from "$lib/components/ui/label/index.js";
    import { compendium } from "$lib/crossover/world/compendium";
    import { cn } from "$lib/shadcn";
    import { playerEquippedItems, playerInventoryItems } from "../../../store";
</script>

<div class={cn("w-full", $$restProps.class)}>
    <Card.Root class="border-none">
        <Card.Content class="space-y-2">
            <!-- Equipped Items -->
            <div class="space-y-1">
                <Label for="current">Equipped</Label>
                <div class="text-xs">
                    {#if $playerEquippedItems.length > 0}
                        {#each $playerEquippedItems as item (item.item)}
                            <p>
                                [{item.locT}] {item.name} ({item.item}) | dur: {item.dur}
                                chg: {item.chg}
                            </p>
                            <!-- Item utilities -->
                            {#each Object.values(compendium[item.prop].utilities) as utility (utility.utility)}
                                <p>
                                    &nbsp;- {utility.utility} ({utility.description})
                                    | dur: {utility.cost.durability} chg: {utility
                                        .cost.charges}
                                </p>
                            {/each}
                        {/each}
                    {:else}
                        <p>Nothing equipped</p>
                    {/if}
                </div>
            </div>
            <!-- Inventory Items -->
            <div class="space-y-1">
                <Label for="new">Bag</Label>
                <div class="text-xs">
                    {#if $playerInventoryItems.length > 0}
                        {#each $playerInventoryItems as item (item.item)}
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
