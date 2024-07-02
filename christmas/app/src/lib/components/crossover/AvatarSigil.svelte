<script lang="ts">
    import * as Avatar from "$lib/components/ui/avatar";
    import type { Player } from "$lib/server/crossover/redis/entities";
    import { cn } from "$lib/shadcn";
    import APBars from "./APBars.svelte";
    import BusyBar from "./BusyBar.svelte";
    import ResourceBars from "./ResourceBars.svelte";

    export let player: Player | null = null;
</script>

{#if player}
    <div class={cn("h-10", $$restProps.class)}>
        <div class="relative h-0 md:bottom-11 sm:bottom-11 bottom-6">
            <!-- Player Avatar -->
            <Avatar.Root class="h-16 w-16 sm:min-h-20 sm:min-w-20">
                <div class="bg-secondary">
                    <div class="avatar-image">
                        <Avatar.Image src={player?.avatar} alt={player?.name} />
                    </div>
                </div>
                <Avatar.Fallback>{player?.name.slice(0, 2)}</Avatar.Fallback>
            </Avatar.Root>
        </div>

        <!-- Busy -->
        <div class="relative h-0 md:bottom-11 sm:bottom-11 bottom-6">
            <BusyBar class="h-16 w-16 sm:min-h-20 sm:min-w-20"></BusyBar>
        </div>
        <!-- AP -->
        <div class="relative h-0 md:bottom-11 sm:bottom-11 bottom-6">
            <APBars class="h-16 w-16 sm:min-h-20 sm:min-w-20"></APBars>
        </div>
        <!-- HP, MP, ST -->
        <div class="relative h-0 md:bottom-11 sm:bottom-11 bottom-6">
            <ResourceBars class="h-16 w-16 sm:min-h-20 sm:min-w-20"
            ></ResourceBars>
        </div>
    </div>
{/if}

<style>
    /* Try to focus the head */
    .avatar-image {
        margin-top: -15px;
        margin-left: -22px;
        width: 128px;
        height: 256px;
    }
</style>
