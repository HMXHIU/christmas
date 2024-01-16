<script lang="ts">
	import { Avatar } from '@skeletonlabs/skeleton';
	import type { Account, Coupon, Store } from '../../../lib/anchor-client/types';
	import { cleanString } from '../../../lib/anchor-client/utils';
	import { fetchMintedCouponSupplyBalance, fetchStoreMetadata } from '$lib';
	import { createCoupon, type CreateCouponFormResult } from '$lib';
	import { getModalStore } from '@skeletonlabs/skeleton';
	import type { ModalSettings } from '@skeletonlabs/skeleton';
	import CreateCouponForm from './CreateCouponForm.svelte';
	import { mintedCoupons, storesMetadata } from '../store';
	import MintedCouponCard from './MintedCouponCard.svelte';

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

	async function onMint(event: CustomEvent<{ numTokens: string; coupon: Account<Coupon> }>) {
		// Refetch coupons
		await fetchMintedCouponSupplyBalance(store);
	}
</script>

{#await fetchStoreMetadata(store.publicKey) then}
	<div class="flex flex-col">
		<!-- Store -->
		<header class="flex flex-row justify-between px-4 py-3 bg-surface-200-700-token">
			<div class="flex flex-row space-x-3 my-auto">
				<div class="w-16 my-auto flex-none">
					{#if $storesMetadata[storeKey].image != null}
						<Avatar src={$storesMetadata[storeKey].image} rounded="rounded-full" />
					{:else}
						<Avatar initials={store.account.name.slice(2)} rounded="rounded-full" />
					{/if}
				</div>
				<div class="flex flex-col my-auto">
					<p class="text-base font-bold">{cleanString(store.account.name)}</p>
					<p class="text-sm italic">{$storesMetadata[storeKey].address}</p>
					<p class="text-sm">{$storesMetadata[storeKey].description}</p>
				</div>
			</div>
			<div class="my-auto relative">
				<button type="button" class="btn-icon variant-filled" on:click={createCouponModal}>
					<svg xmlns="http://www.w3.org/2000/svg" height="16" width="18" viewBox="0 0 576 512">
						<path
							d="M64 64C28.7 64 0 92.7 0 128v64c0 8.8 7.4 15.7 15.7 18.6C34.5 217.1 48 235 48 256s-13.5 38.9-32.3 45.4C7.4 304.3 0 311.2 0 320v64c0 35.3 28.7 64 64 64H512c35.3 0 64-28.7 64-64V320c0-8.8-7.4-15.7-15.7-18.6C541.5 294.9 528 277 528 256s13.5-38.9 32.3-45.4c8.3-2.9 15.7-9.8 15.7-18.6V128c0-35.3-28.7-64-64-64H64zm64 112l0 160c0 8.8 7.2 16 16 16H432c8.8 0 16-7.2 16-16V176c0-8.8-7.2-16-16-16H144c-8.8 0-16 7.2-16 16zM96 160c0-17.7 14.3-32 32-32H448c17.7 0 32 14.3 32 32V352c0 17.7-14.3 32-32 32H128c-17.7 0-32-14.3-32-32V160z"
						/>
					</svg>
				</button>
				<span class="badge-icon absolute bg-surface-700 shadow-none -top-1 -right-1 z-10">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						height="16"
						width="14"
						viewBox="0 0 448 512"
						class="fill-success-500"
					>
						<path
							d="M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z"
						/>
					</svg>
				</span>
			</div>
		</header>

		<!-- Coupons -->
		<div class="grid grid-cols-2 gap-4 px-4 py-4 mt-2">
			{#await fetchMintedCouponSupplyBalance(store) then}
				{#each $mintedCoupons[store.publicKey.toString()] as [coupon, supply, balance]}
					<MintedCouponCard {coupon} {balance} {supply} on:mint={onMint}></MintedCouponCard>
				{/each}
			{/await}
		</div>
	</div>
{/await}
