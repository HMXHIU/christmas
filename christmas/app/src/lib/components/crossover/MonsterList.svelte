<script lang="ts">
    import { monsterRecord } from "../../../store";
</script>

{#if $monsterRecord}
    {#if Object.keys($monsterRecord).length > 0}
        <p class="text-sm text-primary-background">You see some creatures</p>
    {/if}
    <div class="text-sm text-muted-foreground flex flex-wrap gap-y-0 gap-x-2">
        {#each Object.entries($monsterRecord) as [monsterId, monster] (monsterId)}
            <span>{monster.name}</span>
        {/each}
    </div>
{/if}
