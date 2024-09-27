<script lang="ts">
    import { Button } from "$lib/components/ui/button/index.js";
    import * as Card from "$lib/components/ui/card/index.js";
    import * as Dialog from "$lib/components/ui/dialog";
    import { crossoverPlayerQuest } from "$lib/crossover/client";
    import type { Item, Quest } from "$lib/crossover/types";
    import { compendium } from "$lib/crossover/world/settings/compendium";
    import { cn } from "$lib/shadcn";
    import { onMount } from "svelte";
    import { get } from "svelte/store";
    import { playerInventoryItems } from "../../../store";
    import Checkbox from "../ui/checkbox/checkbox.svelte";

    interface QuestWrit {
        writ: string;
        quest: string;
        name: string;
        description: string;
    }

    let isDialogOpen = false;
    let selectedWrit: QuestWrit | null = null;
    let selectedQuest: Quest | null = null;
    let questWrits: QuestWrit[] = [];
    let selectedQuestItems: Item[] = [];

    async function openDialog(quest: QuestWrit) {
        selectedWrit = quest;
        selectedQuest = await crossoverPlayerQuest(quest.writ);
        selectedQuestItems = get(playerInventoryItems).filter(
            ({ prop, vars }) =>
                prop === compendium.questitem.prop &&
                vars.quest === quest.quest,
        );
        isDialogOpen = true;
    }

    onMount(() => {
        playerInventoryItems.subscribe((items) => {
            questWrits = items
                .filter(({ prop }) => prop === compendium.questwrit.prop)
                .map(({ vars, item }) => {
                    return {
                        quest: vars.quest as string,
                        name: vars.name as string,
                        description: vars.description as string,
                        writ: item,
                    };
                });
        });
    });
</script>

<div class={cn("w-full", $$restProps.class)}>
    <Card.Root class="border-none">
        <Card.Content class="p-0 m-0">
            <div class="grid grid-cols-1 gap-2 py-2">
                {#if questWrits.length > 0}
                    {#each questWrits as quest (quest.quest)}
                        <Button
                            variant="link"
                            class="h-full whitespace-normal break-words text-left justify-start p-0 text-muted-foreground text-xs"
                            on:click={() => openDialog(quest)}
                            >{quest.name}</Button
                        >
                    {/each}
                {:else}
                    <p>No Quests</p>
                {/if}
            </div>
        </Card.Content>
    </Card.Root>

    <Dialog.Root bind:open={isDialogOpen}>
        <Dialog.Content class="sm:max-w-[425px]">
            <Dialog.Header>
                <Dialog.Title>Quest</Dialog.Title>
                <Dialog.Description>
                    <div class="flex flex-col space-y-2">
                        <p>{selectedQuest?.name}</p>
                        <p>{selectedQuest?.description}</p>
                    </div>
                </Dialog.Description>
            </Dialog.Header>
            <h2>Objectives</h2>
            <div class="flex flex-col space-2 text-muted-foreground text-sm">
                {#if selectedQuest?.objectives}
                    {#each selectedQuest?.objectives as objective}
                        <div class="flex space-x-2">
                            <Checkbox disabled checked={objective.fulfilled} />
                            <p>{objective.description}</p>
                        </div>
                    {/each}
                {/if}
            </div>
            <h2>Quest Items</h2>
            <div class="flex flex-col space-2 text-muted-foreground text-sm">
                {#each selectedQuestItems as item}
                    <p>{item.name}</p>
                {/each}
            </div>
        </Dialog.Content>
    </Dialog.Root>
</div>
