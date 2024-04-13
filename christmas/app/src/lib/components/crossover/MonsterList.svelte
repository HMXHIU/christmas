<script lang="ts">
    import { monsterRecord } from "../../../store";
</script>

{#if $monsterRecord}
    {#if Object.keys($monsterRecord).length > 0}
        <p class="text-sm text-primary-background">You see some creatures</p>
    {/if}
    <div class="flex gap-2 text-sm text-muted-foreground">
        {#each Object.entries($monsterRecord) as [monsterId, monster] (monsterId)}
            <p>{monster.name}</p>
        {/each}
    </div>
{/if}
