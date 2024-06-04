<script lang="ts">
    import Footer from "$lib/components/crossover/Footer.svelte";
    import "../../app.postcss";
</script>

<!-- Page Content (account for footer(3 rem) header(3.5 rem)) -->
<main class="h-[calc(100dvh-6.5rem)] overflow-y-auto">
    <!-- Your Page Content Goes Here -->
    <div class="mx-auto px-0 py-4 min-h-full">
        <!-- Content Slot -->
        <slot />
    </div>
</main>

<!-- Footer -->
<Footer />
