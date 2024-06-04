<script lang="ts">
    import Footer from "$lib/components/crossover/Footer.svelte";
    import "../../app.postcss";
</script>

<!-- Page Content (account for footer(3 rem) header(3.5 rem)) -->
<main style="height: calc(100dvh - 6.5rem);">
    <!-- Your Page Content Goes Here -->
    <div class="mx-auto px-0 py-0 h-full">
        <!-- Content Slot -->
        <slot />
    </div>
</main>

<!-- Footer -->
<Footer />
