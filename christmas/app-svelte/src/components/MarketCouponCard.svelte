<script lang="ts">
	import { fetchCouponMetadata, fetchStoreMetadata } from '$lib';
	import type {
		Account,
		Coupon,
		TokenAccount,
		CouponMetadata,
		StoreMetadata
	} from '../../../lib/anchor-client/types';
	import { calculateDistance, timeStampToDate } from '../../../lib/utils';
	import BaseCouponCard from './BaseCouponCard.svelte';
	import { userDeviceClient } from '../store';
	import type { ModalSettings, ModalComponent } from '@skeletonlabs/skeleton';
	import { getModalStore } from '@skeletonlabs/skeleton';
	import ClaimCouponForm from './ClaimCouponForm.svelte';

	const modalStore = getModalStore();

	export let coupon: Account<Coupon>;
	export let tokenAccount: TokenAccount;

	let fetchMetadataAsync = fetchMetadata();
	async function fetchMetadata() {
		const couponMetadata = await fetchCouponMetadata(coupon.account);
		const storeMetadata = await fetchStoreMetadata(coupon.account.store);
		const distance = calculateDistance(
			storeMetadata.latitude,
			storeMetadata.longitude,
			$userDeviceClient!.location!.geolocationCoordinates!.latitude!,
			$userDeviceClient!.location!.geolocationCoordinates!.longitude!
		);

		return { couponMetadata, storeMetadata, distance };
	}

	function claimCouponModal({
		couponMetadata,
		storeMetadata,
		distance
	}: {
		couponMetadata: CouponMetadata;
		storeMetadata: StoreMetadata;
		distance: number;
	}): void {
		const c: ModalComponent = { ref: ClaimCouponForm };
		const modal: ModalSettings = {
			type: 'component',
			component: c,
			title: 'Custom Form Component',
			body: 'Complete the form below and then press submit.',
			meta: {
				coupon,
				tokenAccount,
				couponMetadata,
				storeMetadata,
				distance
			},
			response: (r) => console.log('response:', r)
		};
		modalStore.trigger(modal);
	}
</script>

{#await fetchMetadataAsync then { couponMetadata, storeMetadata, distance }}
	<a href={null} on:click={() => claimCouponModal({ couponMetadata, storeMetadata, distance })}>
		<BaseCouponCard
			couponName={coupon.account.name}
			couponImageUrl={couponMetadata.image}
			storeName={storeMetadata.name}
			storeAddress={storeMetadata.address}
			storeImageUrl={storeMetadata.image}
			{distance}
			expiry={timeStampToDate(coupon.account.validTo)}
		></BaseCouponCard>
	</a>
{/await}
