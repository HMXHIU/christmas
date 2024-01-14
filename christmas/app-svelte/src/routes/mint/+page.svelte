<script lang="ts">
	import type { ModalSettings } from '@skeletonlabs/skeleton';
	import { getModalStore } from '@skeletonlabs/skeleton';
	import CreateStoreForm from '../../components/CreateStoreForm.svelte';

	const modalStore = getModalStore();

	function createStoreModal() {
		new Promise<{}>((resolve) => {
			const modal: ModalSettings = {
				type: 'component',
				component: { ref: CreateStoreForm },
				meta: {},
				response: async () => {
					resolve({});
				}
			};
			// Open modal
			modalStore.trigger(modal);
		}).then(() => {});
	}
</script>

<!-- Create store -->
<div class="flex flex-col">
	<button
		type="button"
		class="btn variant-soft-tertiary mx-auto mt-8"
		on:click={async () => await createStoreModal()}>Start By Creating A Community Store</button
	>
</div>
