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
    import { startCase } from "lodash-es";
    import { ChevronDown, Heart, Zap } from "lucide-svelte";
    import * as Collapsible from "../ui/collapsible";
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
        open = false;
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
                    {#if item?.chg > 0}
                        <QuickToolTip text="Charges"
                            ><Badge class="bg-blue-400 px-1.5 py-0"
                                ><Zap class="h-3"></Zap>{item?.chg}</Badge
                            ></QuickToolTip
                        >
                    {/if}
                    {#if item?.dur > 0}
                        <QuickToolTip text="Durability"
                            ><Badge class="bg-red-400  px-1.5 py-0"
                                ><Heart class="h-3"></Heart>{item?.dur}</Badge
                            ></QuickToolTip
                        >
                    {/if}
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

        <!-- Variables (TODO: Show only if owner) -->
        {#if Object.keys(compendium[item.prop].variables).length > 0}
            <Collapsible.Root>
                <div class="flex items-center justify-between">
                    <h4 class="text-sm font-semibold text-muted-foreground">
                        Configure
                    </h4>
                    <Collapsible.Trigger asChild let:builder>
                        <Button
                            builders={[builder]}
                            variant="ghost"
                            size="sm"
                            class="w-9 p-0"
                        >
                            <ChevronDown class="h-4 w-4" />
                            <span class="sr-only">Configure</span>
                        </Button>
                    </Collapsible.Trigger>
                </div>
                <Collapsible.Content>
                    <div class="flex flex-col justify-between">
                        {#each Object.values(compendium[item.prop].variables) as { variable, type, value } (variable)}
                            <Label class="text-sm my-auto p-2"
                                >{startCase(variable)}</Label
                            >
                            <Input
                                id={variable}
                                type={[
                                    "string",
                                    "item",
                                    "monster",
                                    "player",
                                ].includes(type)
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
                    <div class="pt-4 flex justify-end">
                        <Button
                            class="h-8"
                            on:click={() => onConfigure(item, item.vars)}
                            >Configure</Button
                        >
                    </div>
                </Collapsible.Content>
            </Collapsible.Root>
        {/if}
    </Dialog.Content>
</Dialog.Root>
