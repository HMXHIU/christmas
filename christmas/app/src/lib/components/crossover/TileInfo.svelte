<script lang="ts">
    import {
        topologyBufferCache,
        topologyResponseCache,
        topologyResultCache,
    } from "$lib/crossover/caches";
    import {
        biomeAtGeohash,
        tileAtGeohash,
        type Tile,
    } from "$lib/crossover/world/biomes";
    import { onMount } from "svelte";
    import { player } from "../../../store";

    let tile: Tile | null = null;

    onMount(() => {
        return player.subscribe(async (p) => {
            if (!p) return;
            const geohash = p.location[0];
            const [biome, strength] = await biomeAtGeohash(geohash, {
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
