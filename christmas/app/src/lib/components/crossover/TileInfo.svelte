<script lang="ts">
    import {
        topologyBufferCache,
        topologyResponseCache,
        topologyResultCache,
    } from "$lib/components/crossover/Game/caches";
    import { biomeAtGeohash, tileAtGeohash } from "$lib/crossover/world/biomes";
    import type { Tile } from "$lib/crossover/world/types";
    import { onMount } from "svelte";
    import { player } from "../../../store";

    let tile: Tile | null = null;

    onMount(() => {
        return player.subscribe(async (p) => {
            if (!p) return;
            const geohash = p.loc[0];
            const [biome, strength] = await biomeAtGeohash(geohash, p.locT, {
                topologyBufferCache,
                topologyResponseCache,
                topologyResultCache,
            });
            tile = tileAtGeohash(geohash, biome); // TODO: consider strength
        });
    });
</script>

{#if tile}
    <p class="text-sm text-primary-background">
        {tile.name || tile.geohash}
    </p>
    <p class="text-sm text-muted-foreground">
        {tile.description}
    </p>
{/if}
