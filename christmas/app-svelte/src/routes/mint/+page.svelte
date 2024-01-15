<script lang="ts">
	import type { ModalSettings } from '@skeletonlabs/skeleton';
	import { getModalStore } from '@skeletonlabs/skeleton';
	import CreateStoreForm from '../../components/CreateStoreForm.svelte';

	import { createStore, fetchStores } from '$lib';
	import type { CreateStoreFormResult } from '$lib';
	import { stores } from '../../store';
	import StoreSection from '../../components/StoreSection.svelte';

	const modalStore = getModalStore();

	function createStoreModal() {
		new Promise<{}>((resolve) => {
			const modal: ModalSettings = {
				type: 'component',
				component: { ref: CreateStoreForm },
				meta: {},
				response: (values) => {
					resolve(values);
				}
			};
			// Open modal
			modalStore.trigger(modal);
		}).then(async (values) => {
			if (values) {
				// Create store
				await createStore(values as CreateStoreFormResult);
				await fetchStores();
			}
		});
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
	<button
		type="button"
		class="btn variant-soft-tertiary mx-auto my-12"
		on:click={async () => await createStoreModal()}
	>
		{$stores.length > 0 ? 'Start Another Community Store' : 'Start By Creating A Community Store'}
	</button>
</div>
