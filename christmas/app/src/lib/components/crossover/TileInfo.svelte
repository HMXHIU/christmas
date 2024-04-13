<script lang="ts">
    import { tile } from "../../../store";
</script>

{#if $tile}
    <p class="text-sm text-primary-background">
        {$tile.name || $tile.geohash}
    </p>
    <p class="text-sm text-muted-foreground">
        {$tile.description}
    </p>
{/if}
