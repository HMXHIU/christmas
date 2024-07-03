<script lang="ts">
    import * as Card from "$lib/components/ui/card/index.js";
    import { Label } from "$lib/components/ui/label/index.js";
    import { playerActions } from "$lib/crossover/world/actions";
    import { cn } from "$lib/shadcn";
</script>

<div class={cn("w-full", $$restProps.class)}>
    <Card.Root class="border-none">
        <Card.Content class="space-y-2">
            <div class="space-y-1">
                <Label for="current">Actions</Label>
                <div class="text-xs">
                    {#if playerActions.length > 0}
                        {#each playerActions as action (action.action)}
                            <p>{action.action} ({action.description})</p>
                        {/each}
                    {:else}
                        <p>No actions</p>
                    {/if}
                </div>
            </div>
        </Card.Content>
    </Card.Root>
</div>
