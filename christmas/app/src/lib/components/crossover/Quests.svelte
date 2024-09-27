<script lang="ts">
    import { Button } from "$lib/components/ui/button/index.js";
    import * as Card from "$lib/components/ui/card/index.js";
    import * as Dialog from "$lib/components/ui/dialog";
    import { cn } from "$lib/shadcn";
    import { onMount } from "svelte";
    import { playerInventoryItems } from "../../../store";

    import { compendium } from "$lib/crossover/world/settings/compendium";

    interface QuestVars {
        quest: string;
        name: string;
        description: string;
    }

    let isDialogOpen = false;
    let selectedQuest: QuestVars | null = null;

    let quests: QuestVars[] = [];

    function openDialog(quest: QuestVars) {
        selectedQuest = quest;
        isDialogOpen = true;
    }

    onMount(() => {
        playerInventoryItems.subscribe((r) => {
            quests = Object.values(r)
                .filter((i) => i.prop === compendium.questwrit.prop)
                .map((i) => i.vars as any);
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
            <div class="flex flex-col gap-2">
                <div class="flex flex-row gap-2"></div>
            </div>
        </Dialog.Content>
    </Dialog.Root>
</div>
