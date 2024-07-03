<script lang="ts">
    import { PUBLIC_TOPOLOGY_ENDPOINT } from "$env/static/public";
    import { cn } from "$lib/shadcn";
    import { onMount } from "svelte";
    import { player } from "../../../store";

    let mapId: string | null = null;

    onMount(() => {
        const unsubscribePlayer = player.subscribe((p) => {
            if (p !== null && p.locT === "geohash") {
                mapId = p.loc[0].slice(0, 2);
            }
        });

        return () => {
            unsubscribePlayer();
        };
    });
</script>

{#if mapId}
    <div
        class={cn("h-36 w-36 rounded-full overflow-hidden", $$restProps.class)}
        id="map-container"
    >
        <img
            src={`${PUBLIC_TOPOLOGY_ENDPOINT}/${mapId}.png`}
            alt="map"
            class="w-full h-full object-cover"
        />
    </div>
{/if}

<style>
    #map-container {
        border-radius: 50%;
        border: 3px solid #000000; /* Adjust color and width as needed */
        box-shadow: 0 0 0 2px #6c6c6c; /* Optional: adds a white outline outside the black border */
    }
</style>
