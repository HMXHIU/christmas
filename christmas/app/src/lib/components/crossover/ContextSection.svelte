<script lang="ts">
    import * as Avatar from "$lib/components/ui/avatar";
    import { Button } from "$lib/components/ui/button";
    import { cn } from "$lib/shadcn";
    import type { AgentUI } from "./types";

    export let showAvatar = false;
    export let agents: AgentUI[] = [];
</script>

<!-- Navigation -->
<div class={cn("grid grid-rows-[auto_1fr_auto] border-r", $$restProps.class)}>
    <!-- List -->
    <div class="p-4 space-y-4 overflow-y-auto">
        <small class="opacity-50">Contacts</small>
        <div class="flex flex-col space-y-1">
            {#each agents as agent}
                <Button class="w-full flex items-center space-x-4">
                    {#if showAvatar}
                        <Avatar.Root class="my-auto">
                            <Avatar.Image src={agent.avatar} alt={agent.name} />
                            <Avatar.Fallback
                                >{agent.name.slice(2)}</Avatar.Fallback
                            >
                        </Avatar.Root>
                    {/if}
                    <span class="flex-1 text-start">
                        {agent.name}
                    </span>
                </Button>
            {/each}
        </div>
    </div>
</div>
