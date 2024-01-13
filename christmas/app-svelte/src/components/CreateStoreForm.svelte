<script lang="ts">
	import type { SvelteComponent } from 'svelte';
	import { getModalStore } from '@skeletonlabs/skeleton';
	import { STORE_NAME_SIZE, STRING_PREFIX_SIZE } from '../../../lib/anchor-client/defs';
	import ImageInput from './ImageInput.svelte';
	import type { Location } from '../../../lib/user-device-client/types';
	import { userDeviceClient } from '../store';
	import LocationSearch from './LocationSearch.svelte';

	const modalStore = getModalStore();

	export let parent: SvelteComponent;

	let defaultLocation: Location = $userDeviceClient!.location; // fallback to use device location

	// Form Data
	const formData = {
		name: '',
		description: ''
	};

	// We've created a custom submit function to pass the response and close the modal.
	function onCreateStore(): void {
		if ($modalStore[0].response) $modalStore[0].response(formData);
		modalStore.close();
	}
</script>

{#if $modalStore[0]}
	<div class="card space-y-4 shadow-xl">
		<form class="p-4 space-y-4 rounded-container-token'">
			<!-- Store name -->
			<label class="label">
				<span>Name</span>
				<input
					class="input"
					type="text"
					required
					maxlength={STORE_NAME_SIZE - STRING_PREFIX_SIZE}
					bind:value={formData.name}
					placeholder="Give it a nice name :)"
				/>
			</label>

			<!-- Store description -->
			<label class="label">
				<span>Description</span>
				<textarea
					class="textarea"
					rows="4"
					required
					placeholder="What is your community store about?"
					maxlength={400}
					bind:value={formData.description}
				/>
			</label>

			<!-- Store logo -->
			<ImageInput label="Logo" message="150x150"></ImageInput>

			<hr />

			<!-- Address -->
			<LocationSearch label="Address"></LocationSearch>
		</form>
		<!-- prettier-ignore -->
		<footer class="modal-footer p-4 {parent.regionFooter}">
			<button class="btn {parent.buttonNeutral}" on:click={parent.onClose}>Maybe later</button>
			<button class="btn {parent.buttonPositive}" on:click={onCreateStore}>Create Store</button>
		</footer>
	</div>
{/if}
