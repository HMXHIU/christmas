<script lang="ts">
    import { Badge } from "$lib/components/ui/badge/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import * as Dialog from "$lib/components/ui/dialog";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label/index.js";
    import { crossoverCmdConfigureItem } from "$lib/crossover/client";
    import type { Item } from "$lib/crossover/types";
    import { itemAttibutes } from "$lib/crossover/world/compendium";
    import { compendium } from "$lib/crossover/world/settings/compendium";
    import { startCase } from "lodash";
    import { Heart, Zap } from "lucide-svelte";
    import CopyToClipboard from "./CopyToClipboard.svelte";
    import { markdown } from "./Game/markdown";
    import QuickToolTip from "./QuickToolTip.svelte";

    export let item: Item;
    export let open = false;

    async function onConfigure(
        item: Item,
        variables: Record<string, string | number | boolean>,
    ) {
        await crossoverCmdConfigureItem({ item: item.item, variables });
    }
</script>

<Dialog.Root bind:open openFocus={"#grab-focus-from-tooltip"}>
    <Dialog.Content class="sm:max-w-[425px]" id="grab-focus-from-tooltip">
        <!-- Item Name & Description -->
        <Dialog.Header>
            <Dialog.Title
                ><span>
                    <CopyToClipboard text={item.item}></CopyToClipboard>
                </span>{item.name}
                <span>
                    <QuickToolTip text="Charges"
                        ><Badge class="bg-blue-400 px-1.5 py-0"
                            ><Zap class="h-3"></Zap>{item?.chg}</Badge
                        ></QuickToolTip
                    >
                    <QuickToolTip text="Durability"
                        ><Badge class="bg-red-400  px-1.5 py-0"
                            ><Heart class="h-3"></Heart>{item?.dur}</Badge
                        ></QuickToolTip
                    >
                </span></Dialog.Title
            >
            <Dialog.Description class="py-2"
                >{@html markdown(
                    itemAttibutes(item).description,
                )}</Dialog.Description
            >
        </Dialog.Header>

        <!-- Utilities -->
        <div class="flex flex-col gap-2">
            {#each Object.values(compendium[item.prop].utilities) as utility (utility.utility)}
                <div class="border rounded-lg p-3">
                    <p class="text-sm">
                        {startCase(utility.utility)}
                        <span>
                            {#if utility.cost.charges > 0}
                                <QuickToolTip text="Charges">
                                    <Badge class="bg-blue-400  px-1.5 py-0"
                                        ><Zap class="h-3"></Zap>{utility.cost
                                            .charges}</Badge
                                    >
                                </QuickToolTip>
                            {/if}
                            {#if utility.cost.durability > 0}
                                <QuickToolTip text="Durability"
                                    ><Badge class="bg-red-400  px-1.5 py-0"
                                        ><Heart class="h-3"></Heart>{utility
                                            .cost.durability}</Badge
                                    ></QuickToolTip
                                >
                            {/if}
                        </span>
                    </p>
                    <p class="text-sm text-muted-foreground pt-2">
                        {utility.description}
                    </p>
                </div>
            {/each}
        </div>

        <!-- Variables -->
        {#if Object.keys(compendium[item.prop].variables).length > 0}
            <hr />
            <div class="flex flex-col justify-between">
                {#each Object.values(compendium[item.prop].variables) as { variable, type, value } (variable)}
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
                        bind:value={item.vars[variable]}
                        maxlength={100}
                        autofocus={false}
                        class="text-xs text-muted-foreground"
                    />
                {/each}
            </div>
            <Dialog.Footer class="flex flex-row justify-end gap-4">
                <Button
                    class="h-8"
                    on:click={() => onConfigure(item, item.vars)}
                    >Configure</Button
                >
            </Dialog.Footer>
        {/if}
    </Dialog.Content>
</Dialog.Root>
