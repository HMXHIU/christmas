<script lang="ts">
    import GameWindow from "$lib/components/crossover/GameWindow.svelte";
    import { onMount } from "svelte";
    import { trpc } from "$lib/trpc/client";
    import { page } from "$app/stores";

    let greeting = "press the button to load data";
    let loading = false;

    const loadData = async () => {
        loading = true;
        greeting = await trpc().greeting.query();
        loading = false;
    };
</script>

<a
    href="#load"
    role="button"
    class="secondary"
    aria-busy={loading}
    on:click|preventDefault={loadData}>Load</a
>
<p>{greeting}</p>

<GameWindow class="h-full" />
