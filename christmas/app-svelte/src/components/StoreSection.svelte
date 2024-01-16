<script lang="ts">
	import { Avatar } from '@skeletonlabs/skeleton';
	import type { Account, StoreMetadata, Store } from '../../../lib/anchor-client/types';
	import { cleanString } from '../../../lib/anchor-client/utils';
	import { fetchMintedCouponSupplyBalance, fetchStoreMetadata } from '$lib';
	import { createCoupon, type CreateCouponFormResult } from '$lib';
	import { getModalStore } from '@skeletonlabs/skeleton';
	import type { ModalSettings } from '@skeletonlabs/skeleton';
	import CreateCouponForm from './CreateCouponForm.svelte';
	import { mintedCoupons, storesMetadata } from '../store';

	const modalStore = getModalStore();

	export let store: Account<Store>;

	const storeKey = store.publicKey.toString();

	function createCouponModal() {
		new Promise<CreateCouponFormResult>((resolve) => {
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
				await createCoupon({
					...values,
					store
				});
				// Refetch coupons
				await fetchMintedCouponSupplyBalance(store);
			}
		});
	}
</script>

{#await fetchStoreMetadata(store.publicKey) then}
	<div class="flex flex-col">
		<!-- Store -->
		<header class="flex flex-row justify-between px-4 py-3 bg-surface-200-700-token">
			<div class="flex flex-row space-x-3 my-auto">
				{#if $storesMetadata[storeKey].image != null}
					<Avatar src={$storesMetadata[storeKey].image} rounded="rounded-full" />
				{:else}
					<Avatar initials={store.account.name.slice(2)} rounded="rounded-full" />
				{/if}
				<div class="flex flex-col my-auto">
					<p class="text-base font-bold">{cleanString(store.account.name)}</p>
					<p class="text-sm italic">{$storesMetadata[storeKey].address}</p>
					<p class="text-sm">{$storesMetadata[storeKey].description}</p>
				</div>
			</div>
			<div class="my-auto">
				<button type="button" class="btn variant-filled" on:click={createCouponModal}
					>Create Coupon</button
				>
			</div>
		</header>

		<!-- Coupons -->
		{#await fetchMintedCouponSupplyBalance(store) then}
			{#each $mintedCoupons[store.publicKey.toString()] as [coupon, supply, balance]}
				<div class="min-h-32">{coupon.account.name}</div>
				<div class="min-h-32">{supply}</div>
				<div class="min-h-32">{balance}</div>
			{/each}
		{/await}
	</div>
{/await}
