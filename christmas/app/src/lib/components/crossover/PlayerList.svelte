<script lang="ts">
    import { playerRecord } from "../../../store";
</script>

{#if $playerRecord}
    {#if Object.keys($playerRecord).length > 0}
        <p class="text-sm text-primary-background">You see some people</p>
    {/if}
    <div class="flex gap-2 text-sm text-muted-foreground">
        {#each Object.entries($playerRecord) as [playerId, player] (playerId)}
            <p>{player.name}</p>
        {/each}
    </div>
{/if}
