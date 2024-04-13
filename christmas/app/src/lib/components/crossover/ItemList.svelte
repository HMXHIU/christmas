<script lang="ts">
    import { itemRecord } from "../../../store";
</script>

{#if $itemRecord}
    {#if Object.keys($itemRecord).length > 0}
        <p class="text-sm text-primary-background">You see some items</p>
    {/if}
    <div class="flex gap-2 text-sm text-muted-foreground">
        {#each Object.entries($itemRecord) as [itemId, item] (itemId)}
            <p>{item.name}</p>
        {/each}
    </div>
{/if}
