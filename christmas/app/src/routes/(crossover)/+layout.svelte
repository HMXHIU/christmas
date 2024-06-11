<script lang="ts">
    import Footer from "$lib/components/crossover/Footer.svelte";
    import { crossoverPlayerMetadata } from "$lib/crossover";
    import { onMount } from "svelte";
    import "../../app.postcss";
    import { player, userMetadata } from "../../store";

    onMount(() => {
        // Fetch player metadata
        return player.subscribe(async (p) => {
            userMetadata.set(await crossoverPlayerMetadata());
        });
    });
</script>

<!-- Page Content (account for footer) -->
<div class="container pb-12">
    <!-- Slot -->
    <slot></slot>
</div>

<!-- Footer -->
<Footer />
