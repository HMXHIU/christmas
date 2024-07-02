<script lang="ts">
    import { crossoverPlayerMetadata } from "$lib/crossover";
    import { onMount } from "svelte";
    import "../../app.postcss";
    import { player, userMetadata } from "../../store";

    onMount(() => {
        // Fetch player metadata
        const unsubscribePlayer = player.subscribe(async (p) => {
            userMetadata.set(await crossoverPlayerMetadata());
        });

        return () => {
            unsubscribePlayer();
        };
    });
</script>

<!-- Page Content (account for footer) -->
<slot></slot>
