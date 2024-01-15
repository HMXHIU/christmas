<script lang="ts">
	import { AccordionItem, Avatar } from '@skeletonlabs/skeleton';
	import type { Account, StoreMetadata, Store } from '../../../lib/anchor-client/types';
	import { cleanString } from '../../../lib/anchor-client/utils';
	import { fetchStoreMetadata } from '$lib';

	export let store: Account<Store>;

	let fetchMetadataAsync = fetchMetadata();
	async function fetchMetadata(): Promise<{ storeMetadata: StoreMetadata }> {
		const storeMetadata = await fetchStoreMetadata(store.publicKey);
		return { storeMetadata };
	}
</script>

{#await fetchMetadataAsync then { storeMetadata }}
	<div class="flex flex-col">
		<header class="flex flex-row justify-between px-4 py-3 bg-surface-200-700-token">
			<div class="flex flex-row space-x-3 my-auto">
				{#if storeMetadata.image != null}
					<Avatar src={storeMetadata.image} rounded="rounded-full" />
				{:else}
					<Avatar initials={store.account.name.slice(2)} rounded="rounded-full" />
				{/if}
				<div class="flex flex-col my-auto">
					<p class="text-base font-bold">{cleanString(store.account.name)}</p>
					<p class="text-sm italic">{storeMetadata.address}</p>
					<p class="text-sm">{storeMetadata.description}</p>
				</div>
			</div>
			<div class="my-auto">
				<button type="button" class="btn variant-filled">Create Coupon </button>
			</div>
		</header>

		<!-- Coupons -->
		<div class="min-h-32">coupons</div>
	</div>
{/await}

<style>
	.create-coupon-button {
		width: 120px;
		height: 210px;
		border: 2px dashed #3498db; /* Dashed border with a blue color */
		border-radius: 10px; /* Rounded corners */
		background-color: transparent;
		display: flex;
		justify-content: center;
		align-items: center;
		cursor: pointer;
		transition: background-color 0.3s ease;
	}
</style>
