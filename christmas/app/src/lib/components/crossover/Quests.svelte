<script lang="ts">
    import { Button } from "$lib/components/ui/button/index.js";
    import * as Card from "$lib/components/ui/card/index.js";
    import * as Dialog from "$lib/components/ui/dialog";
    import { crossoverPlayerQuest } from "$lib/crossover/client";
    import type { Quest } from "$lib/crossover/types";
    import { compendium } from "$lib/crossover/world/settings/compendium";
    import { cn } from "$lib/shadcn";
    import { onMount } from "svelte";
    import { playerInventoryItems } from "../../../store";

    interface QuestWrit {
        writ: string;
        quest: string;
        name: string;
        description: string;
    }

    let isDialogOpen = false;
    let selectedWrit: QuestWrit | null = null;
    let selectedQuest: Quest | null = null;
    let quests: QuestWrit[] = [];

    async function openDialog(quest: QuestWrit) {
        selectedWrit = quest;
        selectedQuest = await crossoverPlayerQuest(quest.writ);
        isDialogOpen = true;
    }

    onMount(() => {
        playerInventoryItems.subscribe((items) => {
            quests = items
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
            <div class="grid grid-cols-1 gap-2">
                {#if quests.length > 0}
                    {#each quests as quest (quest.quest)}
                        <Button
                            variant="link"
                            class="h-full whitespace-normal break-words text-left justify-start p-0 text-gray-400"
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
                <Dialog.Title>{selectedQuest?.name}</Dialog.Title>
                <Dialog.Description
                    >{selectedQuest?.description}</Dialog.Description
                >
            </Dialog.Header>
            <div class="flex flex-col space-2">
                {#if selectedQuest?.objectives}
                    {#each selectedQuest?.objectives as objective}
                        <p>{objective.description}</p>
                    {/each}
                {/if}
            </div>
        </Dialog.Content>
    </Dialog.Root>
</div>
