<script lang="ts">
    import { groupBy } from "lodash";
    import { monsterRecord } from "../../../store";

    $: groupedMonsters = groupBy($monsterRecord, "name");

    function getMonsterDescription(name: string, count: number): string {
        if (count === 1) {
            return `You see a ${name}`;
        } else if (count === 2) {
            return `You see a pair of ${name}s`;
        } else if (count <= 5) {
            return `You see a small group of ${name}s`;
        } else if (count <= 10) {
            return `You see a pack of ${name}s`;
        } else {
            return `You see a horde of ${name}s`;
        }
    }

    function getAdditionalInfo(monsters: any[]): string {
        const uniqueIds = new Set(monsters.map((m) => m.monster));
        if (uniqueIds.size > 1) {
            return ` (${uniqueIds.size})`;
        }
        return "";
    }
</script>

{#if $monsterRecord && Object.keys($monsterRecord).length > 0}
    <p class="text-sm text-rose-400">
        {#each Object.entries(groupedMonsters) as [name, monsters] (name)}
            <p>
                {getMonsterDescription(name, monsters.length)}
                {getAdditionalInfo(monsters)}.
            </p>
        {/each}
    </p>
{/if}
