<script lang="ts">
    import type { Item } from "$lib/server/crossover/redis/entities";
    import { onMount } from "svelte";
    import { itemRecord } from "../../../store";

    let environmentItems: Item[] = [];

    onMount(() => {
        const unsubscribe = itemRecord.subscribe((ir) => {
            environmentItems = Object.values(ir).filter((item) => {
                return item.locationType === "geohash";
            });
        });
        return unsubscribe;
    });
</script>

{#if environmentItems}
    {#if environmentItems.length > 0}
        <p class="text-sm text-primary-background">You see some items</p>
    {/if}
    <div class="flex gap-2 text-sm text-muted-foreground">
        {#each environmentItems as item (item.item)}
            <p>{item.name} ({item.item})</p>
        {/each}
    </div>
{/if}
