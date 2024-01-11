<script lang="ts">
	import type { ParsedAccountData } from '@solana/web3.js';
	import { fetchCouponMetadata, fetchStoreMetadata } from '$lib';
	import type { Account, Coupon, TokenAccount } from '../../../lib/anchor-client/types';
	import { timeStampToDate } from '../../../lib/utils';
	import BaseCouponCard from './BaseCouponCard.svelte';

	export let coupon: Account<Coupon>;
	export let tokenAccount: TokenAccount;

	let tokenAmount = (tokenAccount.account.data as ParsedAccountData).parsed.info.tokenAmount
		.uiAmount;

	let fetchMetadataAsync = fetchMetadata();
	async function fetchMetadata() {
		return {
			couponMetadata: await fetchCouponMetadata(coupon.account),
			storeMetadata: await fetchStoreMetadata(coupon.account.store)
		};
	}
</script>

{#await fetchMetadataAsync then { couponMetadata, storeMetadata }}
	<BaseCouponCard
		couponName={coupon.account.name}
		couponImageUrl={couponMetadata.image}
		storeName={storeMetadata.name}
		storeAddress={storeMetadata.address}
		storeImageUrl={storeMetadata.image}
		remaining={tokenAmount}
		expiry={timeStampToDate(coupon.account.validTo)}
	></BaseCouponCard>
{/await}
