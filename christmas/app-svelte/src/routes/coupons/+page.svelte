<script lang="ts">
	import ClaimedCouponCard from '../../components/ClaimedCouponCard.svelte';
	import MarketCouponCard from '../../components/MarketCouponCard.svelte';
	import { marketCoupons, claimedCoupons } from '../../store';
</script>

<!-- Claimed coupons -->
<div class="snap-x scroll-px-4 snap-mandatory scroll-smooth flex gap-4 overflow-x-auto px-4 py-5">
	{#each $claimedCoupons as [coupon, balance] (coupon.publicKey)}
		<div class="snap-start shrink-0 card w-40 md:w-80">
			<ClaimedCouponCard {coupon} {balance}></ClaimedCouponCard>
		</div>
	{/each}
</div>

<!-- Market coupons -->
<div class="grid grid-cols-2 gap-4 px-4 py-4 mt-2">
	{#each $marketCoupons as [coupon, tokenAccount] (coupon.publicKey)}
		<MarketCouponCard {coupon} {tokenAccount}></MarketCouponCard>
	{/each}
</div>
