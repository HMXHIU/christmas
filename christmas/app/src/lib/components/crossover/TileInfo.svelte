<script lang="ts">
    import {
        biomeAtGeohash,
        tileAtGeohash,
        type Tile,
    } from "$lib/crossover/world/biomes";
    import { onMount } from "svelte";
    import { player } from "../../../store";

    let tile: Tile | null = null;

    onMount(() => {
        return player.subscribe((p) => {
            if (!p) return;
            const geohash = p.location[0];
            tile = tileAtGeohash(geohash, biomeAtGeohash(geohash)[0]); // TODO: consider strength
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
