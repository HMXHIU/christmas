<script lang="ts">
    import * as Card from "$lib/components/ui/card/index.js";
    import { Label } from "$lib/components/ui/label/index.js";
    import { cn } from "$lib/shadcn";
    import { playerEquippedItems, playerInventoryItems } from "../../../store";
</script>

<div class={cn("w-full", $$restProps.class)}>
    <Card.Root class="border-none">
        <Card.Content class="space-y-2">
            <div class="space-y-1">
                <Label for="current">Equipped</Label>
                <div class="text-xs">
                    {#if $playerEquippedItems.length > 0}
                        {#each $playerEquippedItems as item (item.item)}
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
