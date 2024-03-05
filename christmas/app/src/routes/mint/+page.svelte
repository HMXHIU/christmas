<script lang="ts">
    import { createStore, fetchStores } from "$lib/community";
    import CreateStoreDialog from "$lib/components/community/CreateStoreDialog.svelte";

    import StoreSection from "$lib/components/community/StoreSection.svelte";
    import type { CreateStoreSchema } from "$lib/server/community/router";
    import type { z } from "zod";
    import { stores } from "../../store";

    async function onCreateStore(
        createStoreParams: z.infer<typeof CreateStoreSchema>,
    ) {
        await createStore(createStoreParams);
        await fetchStores();
    }
</script>

<!-- Stores -->
{#await fetchStores() then}
    {#each $stores as s (s.publicKey)}
        <StoreSection store={s}></StoreSection>
    {/each}
{/await}

<!-- Create store -->
<div class="flex flex-col">
    <CreateStoreDialog {onCreateStore}></CreateStoreDialog>
</div>
