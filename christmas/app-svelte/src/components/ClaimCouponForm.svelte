<script lang="ts">
	import type { SvelteComponent } from 'svelte';
	import { getModalStore } from '@skeletonlabs/skeleton';
	import BaseCouponCard from './BaseCouponCard.svelte';
	import type { ParsedAccountData } from '@solana/web3.js';
	import type {
		Account,
		Coupon,
		CouponMetadata,
		Store,
		StoreMetadata
	} from '../../../lib/anchor-client/types';
	import { timeStampToDate } from '../../../lib/utils';

	export let parent: SvelteComponent;

	const modalStore = getModalStore();

	// Form Data
	const formData = {
		name: 'Jane Doe',
		tel: '214-555-1234',
		email: 'jdoe@email.com'
	};

	// Base Classes
	const cBase = 'card w-modal shadow-xl';

	let coupon: Account<Coupon> = $modalStore[0].meta.coupon;
	let couponMetadata: CouponMetadata = $modalStore[0].meta.couponMetadata;
	let storeMetadata: StoreMetadata = $modalStore[0].meta.storeMetadata;
	let distance: number = $modalStore[0].meta.distance;

	let tokenAmount = ($modalStore[0].meta.tokenAccount.account.data as ParsedAccountData).parsed.info
		.tokenAmount.uiAmount;

	function onFormSubmit(): void {
		if ($modalStore[0].response) $modalStore[0].response(formData);
		modalStore.close();
	}
</script>

{#if $modalStore[0]}
	<div class="modal-example-form {cBase}">
		<BaseCouponCard
			couponName={coupon.account.name}
			couponDescription={couponMetadata.description}
			couponImageUrl={couponMetadata.image}
			storeName={storeMetadata.name}
			storeAddress={storeMetadata.address}
			storeImageUrl={storeMetadata.image}
			{distance}
			remaining={tokenAmount}
			expiry={timeStampToDate(coupon.account.validTo)}
		></BaseCouponCard>

		<footer class="modal-footer p-4 {parent.regionFooter}">
			<button class="btn {parent.buttonNeutral}" on:click={parent.onClose}
				>{parent.buttonTextCancel}</button
			>
			<button class="btn {parent.buttonPositive}" on:click={onFormSubmit}>Submit Form</button>
		</footer>
	</div>
{/if}
