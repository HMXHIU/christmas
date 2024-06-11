<script lang="ts">
    import Footer from "$lib/components/crossover/Footer.svelte";
    import "../../app.postcss";
</script>

<!-- Page Content (account for footer) -->
<div class="container pb-12">
    <!-- Slot -->
    <slot></slot>
</div>

<!-- Footer -->
<Footer />
