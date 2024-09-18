<script lang="ts">
    import { Badge } from "$lib/components/ui/badge/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import * as Card from "$lib/components/ui/card/index.js";
    import * as Dialog from "$lib/components/ui/dialog";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label/index.js";
    import type { Item } from "$lib/crossover/types";
    import { itemAttibutes, itemName } from "$lib/crossover/world/compendium";
    import { compendium } from "$lib/crossover/world/settings/compendium";
    import { cn } from "$lib/shadcn";
    import { startCase } from "lodash";
    import { Heart, Zap } from "lucide-svelte";
    import { playerEquippedItems, playerInventoryItems } from "../../../store";

    let isDialogOpen = false;
    let selectedItem: Item | null = null;

    function openDialog(item: Item) {
        selectedItem = item;
        isDialogOpen = true;
    }

    function onConfigure(item: Item | null) {
        console.log(item);
    }
</script>

<div class={cn("w-full", $$restProps.class)}>
    <Card.Root class="border-none">
        <Card.Content class="grid grid-cols-2 gap-2">
            <!-- Equipped Items -->
            <div class="space-y-1">
                <Label for="current">Equipped</Label>
                <div class="text-xs">
                    {#if $playerEquippedItems.length > 0}
                        {#each $playerEquippedItems as item (item.item)}
                            [{item.locT}]
                            <Button
                                variant="link"
                                class="h-6"
                                on:click={() => openDialog(item)}
                                >{itemName(item)}</Button
                            >
                        {/each}
                    {:else}
                        <p>Nothing equipped</p>
                    {/if}
                </div>
            </div>
            <!-- Inventory Items -->
            <div class="space-y-1">
                <Label for="new">Inventory</Label>
                <div class="text-xs">
                    {#if $playerInventoryItems.length > 0}
                        {#each $playerInventoryItems as item (item.item)}
                            <Button
                                variant="link"
                                class="h-6"
                                on:click={() => openDialog(item)}
                                >{itemName(item)}</Button
                            >
                        {/each}
                    {:else}
                        <p>Nothing in your bag</p>
                    {/if}
                </div>
            </div>
        </Card.Content>
    </Card.Root>

    <Dialog.Root bind:open={isDialogOpen}>
        <Dialog.Content class="sm:max-w-[425px]">
            {#if selectedItem != null}
                <!-- Item Name & Description -->
                <Dialog.Header>
                    <Dialog.Title
                        >{itemName(selectedItem)}
                        <span>
                            <Badge class="bg-blue-400 px-1.5 py-0"
                                ><Zap class="h-3"
                                ></Zap>{selectedItem?.chg}</Badge
                            >
                            <Badge class="bg-red-400  px-1.5 py-0"
                                ><Heart class="h-3"
                                ></Heart>{selectedItem?.dur}</Badge
                            >
                        </span></Dialog.Title
                    >
                    <Dialog.Description
                        >{itemAttibutes(selectedItem)
                            .description}</Dialog.Description
                    >
                </Dialog.Header>

                <!-- Utilities -->
                <div class="flex flex-col gap-2">
                    {#each Object.values(compendium[selectedItem.prop].utilities) as utility (utility.utility)}
                        <div class="border rounded-lg p-3">
                            <p class="text-sm">
                                {startCase(utility.utility)}
                                <span>
                                    {#if utility.cost.charges > 0}<Badge
                                            class="bg-blue-400  px-1.5 py-0"
                                            ><Zap class="h-3"></Zap>{utility
                                                .cost.charges}</Badge
                                        >{/if}
                                    {#if utility.cost.durability > 0}<Badge
                                            class="bg-red-400  px-1.5 py-0"
                                            ><Heart class="h-3"></Heart>{utility
                                                .cost.durability}</Badge
                                        >{/if}
                                </span>
                            </p>
                            <p class="text-sm text-muted-foreground">
                                {utility.description}
                            </p>
                        </div>
                    {/each}
                </div>

                <!-- Variables -->
                {#if Object.keys(compendium[selectedItem.prop].variables).length > 0}
                    <hr />
                    <div class="flex flex-row justify-between">
                        {#each Object.values(compendium[selectedItem.prop].variables) as { variable, type, value } (variable)}
                            <Label class="text-sm my-auto p-2"
                                >{startCase(variable)}</Label
                            >
                            <Input
                                id={variable}
                                type={type === "string"
                                    ? "text"
                                    : type === "number"
                                      ? "number"
                                      : "checkbox"}
                                {value}
                                maxlength={100}
                                autofocus={false}
                                class="text-xs text-muted-foreground"
                            />
                        {/each}
                    </div>
                    <Dialog.Footer class="flex flex-row justify-end gap-4">
                        <Button
                            class="h-8"
                            on:click={() => onConfigure(selectedItem)}
                            >Configure</Button
                        >
                    </Dialog.Footer>
                {/if}
            {/if}
        </Dialog.Content>
    </Dialog.Root>
</div>
