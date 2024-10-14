<script lang="ts">
    import { Button } from "$lib/components/ui/button/index.js";
    import * as Card from "$lib/components/ui/card/index.js";
    import { Label } from "$lib/components/ui/label/index.js";
    import type { Item } from "$lib/crossover/types";
    import { cn } from "$lib/shadcn";
    import { playerEquippedItems, playerInventoryItems } from "../../../store";
    import ItemDialog from "./ItemDialog.svelte";

    let isDialogOpen = false;
    let selectedItem: Item | null = null;

    function openDialog(item: Item) {
        selectedItem = item;
        isDialogOpen = true;
    }
</script>

<div class={cn("w-full", $$restProps.class)}>
    <Card.Root class="border-none">
        <Card.Content class="p-0 m-0 ">
            <div class="grid grid-cols-1 gap-2">
                <!-- Equipped Items -->
                <div>
                    <Label>Equipped</Label>
                    <div class="flex flex-col space-y-2 py-2">
                        {#if $playerEquippedItems.length > 0}
                            {#each $playerEquippedItems as item (item.item)}
                                <Button
                                    variant="link"
                                    class="h-full text-xs text-muted-foreground whitespace-normal break-words text-left justify-start p-0"
                                    on:click={() => openDialog(item)}
                                    >[{item.locT}] {item.name}</Button
                                >
                            {/each}
                        {:else}
                            <p>Nothing equipped</p>
                        {/if}
                    </div>
                </div>
                <!-- Inventory Items -->
                <div>
                    <Label>Inventory</Label>
                    <div class="flex flex-col space-y-2 py-2">
                        {#if $playerInventoryItems.length > 0}
                            {#each $playerInventoryItems as item (item.item)}
                                <Button
                                    variant="link"
                                    class="h-full text-xs text-muted-foreground whitespace-normal break-words text-left justify-start p-0"
                                    on:click={() => openDialog(item)}
                                    >{item.name}</Button
                                >
                            {/each}
                        {:else}
                            <p class="text-xs text-muted-foreground">
                                Nothing in your bag
                            </p>
                        {/if}
                    </div>
                </div>
            </div>
        </Card.Content>
    </Card.Root>

    {#if selectedItem}
        <ItemDialog item={selectedItem} bind:open={isDialogOpen}></ItemDialog>
    {/if}
</div>
