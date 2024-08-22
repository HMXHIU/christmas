<script lang="ts">
    import {
        MudDescriptionGenerator,
        type Descriptor,
    } from "$lib/crossover/mud";
    import { biomes } from "$lib/crossover/world/biomes";
    import { worldSeed } from "$lib/crossover/world/settings/world";
    import {
        geohashLocationTypes,
        type LocationType,
    } from "$lib/crossover/world/types";
    import { sanctuaries } from "$lib/crossover/world/world";
    import { cn } from "$lib/shadcn";
    import { onMount } from "svelte";
    import {
        itemRecord,
        monsterRecord,
        player,
        playerRecord,
    } from "../../../../store";

    const descriptionGenerator = new MudDescriptionGenerator({
        worldSeed,
        sanctuaries,
        biomes,
    });
    let descriptor: Descriptor | null = null;

    async function updateDescriptor() {
        if ($player) {
            descriptor = await descriptionGenerator.descriptionAtLocation(
                $player.loc[0],
                $player.locT as LocationType,
                {
                    players: Object.values($playerRecord).filter((p) =>
                        geohashLocationTypes.has(p.locT),
                    ),
                    monsters: Object.values($monsterRecord).filter((m) =>
                        geohashLocationTypes.has(m.locT),
                    ),
                    items: Object.values($itemRecord).filter((i) =>
                        geohashLocationTypes.has(i.locT),
                    ),
                },
            );

            console.log(JSON.stringify(descriptor, null, 2));
        }
    }

    onMount(() => {
        const subscriptions = [
            player.subscribe(updateDescriptor),
            monsterRecord.subscribe(updateDescriptor),
            itemRecord.subscribe(updateDescriptor),
            playerRecord.subscribe(updateDescriptor),
        ];
        return () => {
            for (const unsubscribe of subscriptions) {
                unsubscribe();
            }
        };
    });
</script>

{#if descriptor}
    <div class={cn("w-full flex flex-col gap-2", $$restProps.class)}>
        <!-- Location Name -->
        <p class="text-sm text-primary-background">
            {descriptor.name || descriptor.location}
        </p>
        <!-- Location -->
        <p class="text-sm text-muted-foreground">
            {descriptor.descriptions.location}
        </p>
        <div class="flex flex-col">
            <!-- Monsters -->
            {#if descriptor.descriptions.monsters}
                <p class="text-sm text-rose-400">
                    {descriptor.descriptions.monsters}
                </p>
            {/if}
            <!-- items -->
            {#if descriptor.descriptions.items}
                <p class="text-sm text-sky-400">
                    {descriptor.descriptions.items}
                </p>
            {/if}
            <!-- Players -->
            {#if descriptor.descriptions.players}
                <p class="text-sm text-lime-400">
                    {descriptor.descriptions.players}
                </p>
            {/if}
        </div>
    </div>
{/if}
