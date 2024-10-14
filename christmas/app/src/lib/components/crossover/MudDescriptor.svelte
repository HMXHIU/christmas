<script lang="ts">
    import {
        topologyBufferCache,
        topologyResponseCache,
        topologyResultCache,
    } from "$lib/crossover/caches";
    import {
        MudDescriptionGenerator,
        type LocationDescription,
    } from "$lib/crossover/mud";
    import { biomes } from "$lib/crossover/world/biomes";
    import { worldSeed } from "$lib/crossover/world/settings/world";
    import {
        geohashLocationTypes,
        type LocationType,
    } from "$lib/crossover/world/types";
    import { cn } from "$lib/shadcn";
    import { onMount } from "svelte";
    import {
        itemRecord,
        monsterRecord,
        player,
        playerRecord,
    } from "../../../store";
    import CopyToClipboard from "./CopyToClipboard.svelte";
    import InteractiveText from "./InteractiveText.svelte";

    const descriptionGenerator = new MudDescriptionGenerator({
        worldSeed,
        biomes,
        topologyResultCache,
        topologyBufferCache,
        topologyResponseCache,
    });
    let locationDescriptor: LocationDescription | null = null;
    let playerDescriptor = "";
    let monsterDescriptor = "";
    let itemDescriptor = "";

    async function updateDescriptor() {
        if ($player) {
            locationDescriptor =
                await descriptionGenerator.locationDescriptions(
                    $player.loc[0],
                    $player.locT as LocationType,
                );
        }
    }

    onMount(() => {
        const subscriptions = [
            player.subscribe(updateDescriptor),
            monsterRecord.subscribe(async (mr) => {
                monsterDescriptor =
                    await descriptionGenerator.monsterDescriptions(
                        Object.values(mr).filter((p) =>
                            geohashLocationTypes.has(p.locT),
                        ),
                    );
            }),
            itemRecord.subscribe(async (ir) => {
                itemDescriptor = await descriptionGenerator.itemDescriptions(
                    Object.values(ir).filter((p) =>
                        geohashLocationTypes.has(p.locT),
                    ),
                );
            }),
            playerRecord.subscribe(async (pr) => {
                playerDescriptor =
                    await descriptionGenerator.playerDescriptions(
                        Object.values(pr).filter((p) =>
                            geohashLocationTypes.has(p.locT),
                        ),
                    );
            }),
        ];
        return () => {
            for (const unsubscribe of subscriptions) {
                unsubscribe();
            }
        };
    });
</script>

{#if locationDescriptor}
    <div class={cn("w-full flex flex-col gap-2", $$restProps.class)}>
        <!-- Location Name -->
        <p class="text-xs text-primary-background">
            <span
                ><CopyToClipboard text={locationDescriptor.location}
                ></CopyToClipboard></span
            >
            {locationDescriptor.name || locationDescriptor.location}
        </p>
        <!-- Location -->
        <p class="text-xs text-muted-foreground">
            {locationDescriptor.descriptions.location}
        </p>
        <!-- Time/Season/Weather -->
        <p class="text-xs text-muted-foreground">
            {locationDescriptor.descriptions.time}
            {locationDescriptor.descriptions.weather}
        </p>
        <div class="flex flex-col">
            <!-- Monsters -->
            {#if monsterDescriptor}
                <p class="text-xs text-rose-400">
                    <InteractiveText text={monsterDescriptor} on:entityLink
                    ></InteractiveText>
                </p>
            {/if}
            <!-- items -->
            {#if itemDescriptor}
                <p class="text-xs text-sky-400">
                    <InteractiveText text={itemDescriptor} on:entityLink
                    ></InteractiveText>
                </p>
            {/if}
            <!-- Players -->
            {#if playerDescriptor}
                <p class="text-xs text-lime-400">
                    <InteractiveText text={playerDescriptor} on:entityLink
                    ></InteractiveText>
                </p>
            {/if}
        </div>
    </div>
{/if}
