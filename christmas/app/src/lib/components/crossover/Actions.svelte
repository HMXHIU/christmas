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
    import { markdown } from "./Game/markdown";
    import QuickToolTip from "./QuickToolTip.svelte";

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
            <div class="grid grid-cols-2 gap-2">
                {#if playerActions.length > 0}
                    {#each playerActions as action (action.action)}
                        <Button
                            variant="link"
                            class="h-full whitespace-normal break-words text-left justify-start p-0 text-muted-foreground text-xs"
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

    <Dialog.Root
        bind:open={isDialogOpen}
        openFocus={"#grab-focus-from-tooltip"}
    >
        <Dialog.Content class="sm:max-w-[425px]" id="grab-focus-from-tooltip">
            <Dialog.Header>
                <Dialog.Title>{selectedAction?.action}</Dialog.Title>
                <Dialog.Description class="py-2"
                    >{@html markdown(
                        selectedAction?.description,
                    )}</Dialog.Description
                >
            </Dialog.Header>
            <div class="flex flex-col gap-2">
                <div class="flex flex-row gap-2">
                    <QuickToolTip text="Range">
                        <Badge>
                            <Target class="h-4"></Target>
                            {selectedAction?.range}
                        </Badge>
                    </QuickToolTip>
                    {#if selectedAction?.ticks && selectedAction?.ticks > 0}
                        <QuickToolTip text="Ticks">
                            <Badge>
                                <Clock class="h-4"></Clock>
                                {selectedAction?.ticks}
                            </Badge>
                        </QuickToolTip>
                    {/if}
                </div>
            </div>
        </Dialog.Content>
    </Dialog.Root>
</div>
