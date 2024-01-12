<script lang="ts">
	import MarketCouponCard from '../../components/MarketCouponCard.svelte';
	import { marketCoupons } from '../../store';
</script>

<!-- Claimed coupons -->
<div class="snap-x scroll-px-4 snap-mandatory scroll-smooth flex gap-4 overflow-x-auto px-4 py-10">
	{#each Array.from({ length: 8 }) as _, i}
		<div class="snap-start shrink-0 card py-20 w-40 md:w-80 text-center">{i + 1}</div>
	{/each}
</div>

<!-- Market coupons -->
<div class="grid grid-cols-2 gap-4 px-4 py-4">
	{#each $marketCoupons as [coupon, tokenAccount] (coupon.publicKey)}
		<MarketCouponCard {coupon} {tokenAccount}></MarketCouponCard>
	{/each}
</div>
