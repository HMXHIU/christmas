<script lang="ts">
    import {
        createStore,
        fetchStores,
        type CreateStoreParams,
    } from "$lib/community";
    import CreateStoreDialog from "$lib/components/community/CreateStoreDialog.svelte";

    import StoreSection from "$lib/components/community/StoreSection.svelte";
    import { stores } from "../../../store";

    async function onCreateStore(createStoreParams: CreateStoreParams) {
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
