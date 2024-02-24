<script lang="ts">
    import CreateStoreDialog from "$lib/components/CreateStoreDialog.svelte";
    import { Button } from "$lib/components/ui/button";
    import * as Dialog from "$lib/components/ui/dialog";
    import { Dialog as BitsDialog } from "bits-ui";
    import { createStore, fetchStores } from "$lib/community";
    import type { CreateStoreParams } from "$lib/community/types";
    import { stores } from "../../store";
    import StoreSection from "$lib/components/StoreSection.svelte";

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
