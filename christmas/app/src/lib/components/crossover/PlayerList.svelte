<script lang="ts">
    import { playerRecord } from "../../../store";
</script>

{#if $playerRecord}
    {#if Object.keys($playerRecord).length > 0}
        <p class="text-sm text-primary-background">You see some people</p>
    {/if}
    <div class="text-sm text-muted-foreground flex flex-wrap gap-y-0 gap-x-2">
        {#each Object.entries($playerRecord) as [playerId, player] (playerId)}
            <p>{player.name} ({player.player})</p>
        {/each}
    </div>
{/if}
