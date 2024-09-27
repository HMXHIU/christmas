<script lang="ts">
    import { Badge } from "$lib/components/ui/badge/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import * as Card from "$lib/components/ui/card/index.js";
    import * as Dialog from "$lib/components/ui/dialog";
    import { type Action, type Actions } from "$lib/crossover/world/actions";
    import {
        actions,
        playerActions,
    } from "$lib/crossover/world/settings/actions";
    import { cn } from "$lib/shadcn";
    import { Clock, Target } from "lucide-svelte";

    let isDialogOpen = false;
    let selectedAction: Action | null = null;

    function openDialog(action: Actions) {
        selectedAction = actions[action];
        isDialogOpen = true;
    }

    // TODO: Add predicate and how to use
</script>

<div class={cn("w-full", $$restProps.class)}>
    <Card.Root class="border-none">
        <Card.Content class="p-0 m-0">
            <div class="grid grid-cols-2 text-xs p-2">
                {#if playerActions.length > 0}
                    {#each playerActions as action (action.action)}
                        <Button
                            variant="link"
                            class="h-6 text-gray-400"
                            on:click={() => openDialog(action.action)}
                            >{action.action}</Button
                        >
                    {/each}
                {:else}
                    <p>No actions</p>
                {/if}
            </div>
        </Card.Content>
    </Card.Root>

    <Dialog.Root bind:open={isDialogOpen}>
        <Dialog.Content class="sm:max-w-[425px]">
            <Dialog.Header>
                <Dialog.Title>{selectedAction?.action}</Dialog.Title>
                <Dialog.Description
                    >{selectedAction?.description}</Dialog.Description
                >
            </Dialog.Header>
            <div class="flex flex-col gap-2">
                <div class="flex flex-row gap-2">
                    <Badge>
                        <Target class="h-4"></Target>
                        {selectedAction?.range}
                    </Badge>
                    {#if selectedAction?.ticks && selectedAction?.ticks > 0}
                        <Badge>
                            <Clock class="h-4"></Clock>
                            {selectedAction?.ticks}
                        </Badge>
                    {/if}
                </div>
            </div>
        </Dialog.Content>
    </Dialog.Root>
</div>
