<script lang="ts">
    import { Badge } from "$lib/components/ui/badge";
    import { getGameActionId } from "$lib/crossover/ir";
    import { cn } from "$lib/shadcn";
    import { gameCommands } from "../../../store";
</script>

<div class={cn("flex flex-col w-full gap-1", $$restProps.class)}>
    {#each $gameCommands as [gameAction, gameEntities, variables]}
        <Badge variant="secondary" class="w-full"
            >{getGameActionId(gameAction)[0]}</Badge
        >
    {/each}
    <Badge variant="secondary" class="w-full text-xs">Test</Badge>
    <Badge variant="secondary" class="w-full text-xs">Test</Badge>
</div>
