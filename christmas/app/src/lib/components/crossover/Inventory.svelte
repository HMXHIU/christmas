<script lang="ts">
    import { Badge } from "$lib/components/ui/badge/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import * as Card from "$lib/components/ui/card/index.js";
    import * as Dialog from "$lib/components/ui/dialog";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label/index.js";
    import { crossoverCmdConfigureItem } from "$lib/crossover/client";
    import type { Item } from "$lib/crossover/types";
    import { itemAttibutes } from "$lib/crossover/world/compendium";
    import { compendium } from "$lib/crossover/world/settings/compendium";
    import { cn } from "$lib/shadcn";
    import { startCase } from "lodash";
    import { Heart, Zap } from "lucide-svelte";
    import { playerEquippedItems, playerInventoryItems } from "../../../store";
    import { markdown } from "./Game/markdown";
    import QuickToolTip from "./QuickToolTip.svelte";

    let isDialogOpen = false;
    let selectedItem: Item | null = null;

    let itemVars: Record<string, string | number | boolean> = {};

    function openDialog(item: Item) {
        selectedItem = item;
        itemVars = { ...item.vars };
        isDialogOpen = true;
    }

    async function onConfigure(
        item: Item | null,
        variables: Record<string, string | number | boolean>,
    ) {
        if (item) {
            await crossoverCmdConfigureItem({ item: item.item, variables });
        }
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

    <Dialog.Root
        bind:open={isDialogOpen}
        openFocus={"#grab-focus-from-tooltip"}
    >
        <Dialog.Content class="sm:max-w-[425px]" id="grab-focus-from-tooltip">
            {#if selectedItem != null}
                <!-- Item Name & Description -->
                <Dialog.Header>
                    <Dialog.Title
                        >{selectedItem.name}
                        <span>
                            <QuickToolTip text="Charges"
                                ><Badge class="bg-blue-400 px-1.5 py-0"
                                    ><Zap class="h-3"
                                    ></Zap>{selectedItem?.chg}</Badge
                                ></QuickToolTip
                            >
                            <QuickToolTip text="Durability"
                                ><Badge class="bg-red-400  px-1.5 py-0"
                                    ><Heart class="h-3"
                                    ></Heart>{selectedItem?.dur}</Badge
                                ></QuickToolTip
                            >
                        </span></Dialog.Title
                    >
                    <Dialog.Description class="py-2"
                        >{@html markdown(
                            itemAttibutes(selectedItem).description,
                        )}</Dialog.Description
                    >
                </Dialog.Header>

                <!-- Utilities -->
                <div class="flex flex-col gap-2">
                    {#each Object.values(compendium[selectedItem.prop].utilities) as utility (utility.utility)}
                        <div class="border rounded-lg p-3">
                            <p class="text-sm">
                                {startCase(utility.utility)}
                                <span>
                                    {#if utility.cost.charges > 0}
                                        <QuickToolTip text="Charges">
                                            <Badge
                                                class="bg-blue-400  px-1.5 py-0"
                                                ><Zap class="h-3"></Zap>{utility
                                                    .cost.charges}</Badge
                                            >
                                        </QuickToolTip>
                                    {/if}
                                    {#if utility.cost.durability > 0}
                                        <QuickToolTip text="Durability"
                                            ><Badge
                                                class="bg-red-400  px-1.5 py-0"
                                                ><Heart class="h-3"
                                                ></Heart>{utility.cost
                                                    .durability}</Badge
                                            ></QuickToolTip
                                        >
                                    {/if}
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
                    <div class="flex flex-col justify-between">
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
                                bind:value={itemVars[variable]}
                                maxlength={100}
                                autofocus={false}
                                class="text-xs text-muted-foreground"
                            />
                        {/each}
                    </div>
                    <Dialog.Footer class="flex flex-row justify-end gap-4">
                        <Button
                            class="h-8"
                            on:click={() => onConfigure(selectedItem, itemVars)}
                            >Configure</Button
                        >
                    </Dialog.Footer>
                {/if}
            {/if}
        </Dialog.Content>
    </Dialog.Root>
</div>
