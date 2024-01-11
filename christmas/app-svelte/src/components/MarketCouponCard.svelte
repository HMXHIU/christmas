<script lang="ts">
	import type { ParsedAccountData } from '@solana/web3.js';
	import { fetchCouponMetadata, fetchStoreMetadata } from '$lib';
	import type { Account, Coupon, TokenAccount } from '../../../lib/anchor-client/types';
	import { calculateDistance, timeStampToDate } from '../../../lib/utils';
	import BaseCouponCard from './BaseCouponCard.svelte';
	import { userDeviceClient } from '../store';

	export let coupon: Account<Coupon>;
	export let tokenAccount: TokenAccount;

	let tokenAmount = (tokenAccount.account.data as ParsedAccountData).parsed.info.tokenAmount
		.uiAmount;

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
</script>

{#await fetchMetadataAsync then { couponMetadata, storeMetadata, distance }}
	<BaseCouponCard
		couponName={coupon.account.name}
		couponImageUrl={couponMetadata.image}
		storeName={storeMetadata.name}
		storeAddress={storeMetadata.address}
		storeImageUrl={storeMetadata.image}
		remaining={tokenAmount}
		{distance}
		expiry={timeStampToDate(coupon.account.validTo)}
	></BaseCouponCard>
{/await}
