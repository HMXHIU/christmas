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
    import type { Player } from "$lib/crossover/types";
    import { sameLocation } from "$lib/crossover/utils";
    import { biomes } from "$lib/crossover/world/biomes";
    import { worldSeed } from "$lib/crossover/world/settings/world";
    import {
        geohashLocationTypes,
        type LocationType,
    } from "$lib/crossover/world/types";
    import { cn } from "$lib/shadcn";
    import { onMount } from "svelte";
    import { get } from "svelte/store";
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

    $: name = $player && locationName($player);

    function locationName(p: Player): string {
        // Player is inside an item world
        if (p.locT === "in") {
            const item = get(itemRecord)[p.locI];
            if (item) {
                return item.name;
            }
        } else if (p.locT === "limbo") {
            return "Limbo";
        } else if (geohashLocationTypes.has(p.locT)) {
            return p.loc[0];
        }
        return "The Abyss";
    }

    onMount(() => {
        const subscriptions = [
            player.subscribe(async (p) => {
                if (p) {
                    locationDescriptor =
                        await descriptionGenerator.describeSurroundings(
                            p.loc[0],
                            p.locT as LocationType,
                            p.locI,
                        );
                }
            }),
            monsterRecord.subscribe(async (mr) => {
                if (!$player) return;
                monsterDescriptor =
                    await descriptionGenerator.descriptionsMonsters(
                        $player,
                        Object.values(mr).filter(
                            (m) =>
                                geohashLocationTypes.has(m.locT) &&
                                sameLocation(m, $player),
                        ),
                    );
            }),
            itemRecord.subscribe(async (ir) => {
                if (!$player) return;
                itemDescriptor = await descriptionGenerator.describeItems(
                    $player,
                    Object.values(ir).filter(
                        (i) =>
                            geohashLocationTypes.has(i.locT) &&
                            sameLocation(i, $player),
                    ),
                );
            }),
            playerRecord.subscribe(async (pr) => {
                if (!$player) return;
                playerDescriptor = await descriptionGenerator.describePlayers(
                    $player,
                    Object.values(pr).filter(
                        (p) =>
                            geohashLocationTypes.has(p.locT) &&
                            sameLocation(p, $player),
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
            {name}
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
