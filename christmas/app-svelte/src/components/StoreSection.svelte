<script lang="ts">
	import { Avatar } from '@skeletonlabs/skeleton';
	import type { Account, StoreMetadata, Store } from '../../../lib/anchor-client/types';
	import { cleanString } from '../../../lib/anchor-client/utils';
	import { fetchStoreMetadata } from '$lib';
	import type { CreateCouponFormResult } from '$lib';
	import { getModalStore } from '@skeletonlabs/skeleton';
	import type { ModalSettings } from '@skeletonlabs/skeleton';
	import CreateCouponForm from './CreateCouponForm.svelte';

	const modalStore = getModalStore();

	export let store: Account<Store>;

	let fetchMetadataAsync = fetchMetadata();
	async function fetchMetadata(): Promise<{ storeMetadata: StoreMetadata }> {
		const storeMetadata = await fetchStoreMetadata(store.publicKey);
		return { storeMetadata };
	}

	function createCouponModal() {
		new Promise<{}>((resolve) => {
			const modal: ModalSettings = {
				type: 'component',
				component: { ref: CreateCouponForm },
				meta: {},
				response: (values) => {
					resolve(values);
				}
			};
			// Open modal
			modalStore.trigger(modal);
		}).then(async (values) => {
			if (values) {
				// Create coupon
				// await createCoupon(values as CreateCouponFormResult);
			}
		});
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
				<button type="button" class="btn variant-filled" on:click={createCouponModal}
					>Create Coupon</button
				>
			</div>
		</header>

		<!-- Coupons -->
		<div class="min-h-32">coupons</div>
	</div>
{/await}
