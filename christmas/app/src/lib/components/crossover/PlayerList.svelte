<script lang="ts">
    import { get } from "svelte/store";
    import { player, playerRecord } from "../../../store";

    function getPlayerDescription(players: any[]): string {
        const count = players.length;
        if (count === 0) return "";
        if (count === 1) return `${players[0].name} is here.`;
        if (count === 2)
            return `${players[0].name} and ${players[1].name} are here.`;
        if (count === 3)
            return `${players[0].name}, ${players[1].name}, and ${players[2].name} are here.`;
        if (count <= 5) {
            const names = players.map((p) => p.name);
            const lastPlayer = names.pop();
            return `${names.join(", ")}, and ${lastPlayer} are here.`;
        }
        return `A group of ${count} adventurers are gathered here.`;
    }

    function getActivityDescription(players: any[]): string {
        const activities = [
            "examining their surroundings",
            "checking their equipment",
            "discussing their next move",
            "resting briefly",
            "looking at a map",
        ];
        if (players.length <= 3) return "";
        const activity =
            activities[Math.floor(Math.random() * activities.length)];
        return ` Some are ${activity}.`;
    }

    $: visiblePlayers = Object.values($playerRecord).filter(
        (p) => p.player !== get(player)?.player,
    );
</script>

{#if visiblePlayers.length > 0}
    <p class="text-sm text-lime-400">
        {getPlayerDescription(visiblePlayers)}
        {getActivityDescription(visiblePlayers)}
    </p>
{/if}
