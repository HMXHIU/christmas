<script lang="ts">
	import MarketCouponCard from '../../components/MarketCouponCard.svelte';
	import { marketCoupons } from '../../store';
</script>

<div class="grid grid-cols-2 gap-4 px-4 py-4">
	{#each $marketCoupons as [coupon, tokenAccount] (coupon.publicKey)}
		<MarketCouponCard {coupon} {tokenAccount}></MarketCouponCard>
	{/each}
</div>
