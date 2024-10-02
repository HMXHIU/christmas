<script lang="ts">
    import { createStore, fetchStores } from "$lib/community";
    import type { CreateStore } from "$lib/community/types";
    import CreateStoreDialog from "$lib/components/community/CreateStoreDialog.svelte";

    import StoreSection from "$lib/components/community/StoreSection.svelte";
    import { stores } from "../../../store";

    async function onCreateStore(createStoreParams: CreateStore) {
        await createStore(createStoreParams);
        await fetchStores();
    }
</script>

<!-- Stores -->
{#await fetchStores() then}
    {#each $stores as s (s.store)}
        <StoreSection store={s}></StoreSection>
    {/each}
{/await}

<!-- Create store -->
<div class="flex flex-col">
    <CreateStoreDialog {onCreateStore}></CreateStoreDialog>
</div>
