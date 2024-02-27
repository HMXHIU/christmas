<script lang="ts">
    import type { Entity } from "$lib/crossover/types";
    import { Button } from "$lib/components/ui/button";
    import * as Avatar from "$lib/components/ui/avatar";
    import { cn } from "$lib/shadcn";

    export let showAvatar = false;
    export let entities: Entity[] = [];
</script>

<!-- Navigation -->
<div class={cn("grid grid-rows-[auto_1fr_auto] border-r", $$restProps.class)}>
    <!-- List -->
    <div class="p-4 space-y-4 overflow-y-auto">
        <small class="opacity-50">Contacts</small>
        <div class="flex flex-col space-y-1">
            {#each entities as entity}
                <Button class="w-full flex items-center space-x-4">
                    {#if showAvatar}
                        <Avatar.Root class="my-auto">
                            <Avatar.Image
                                src={entity.avatar}
                                alt={entity.name}
                            />
                            <Avatar.Fallback
                                >{entity.name.slice(2)}</Avatar.Fallback
                            >
                        </Avatar.Root>
                    {/if}
                    <span class="flex-1 text-start">
                        {entity.name}
                    </span>
                </Button>
            {/each}
        </div>
    </div>
</div>
