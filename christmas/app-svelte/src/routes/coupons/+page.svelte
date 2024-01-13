<script lang="ts">
	import ClaimedCouponCard from '../../components/ClaimedCouponCard.svelte';
	import MarketCouponCard from '../../components/MarketCouponCard.svelte';
	import { marketCoupons, claimedCoupons } from '../../store';

	// News
	let news = new Array();
	if ($marketCoupons.length < 1) {
		news.push(['', 'Anything to give to your community?']);
		news.push(['', 'Start by creating a store']);
	} else {
		news.push(['', `${$marketCoupons.length} community coupons near you`]);
	}
	news.push(['text-error-400', 'Beware of scams, visit your community store physically']);
	news = [...news, ...news]; // need double for wrap around scolling
</script>

<!-- Claimed coupons -->
<div
	class="snap-x scroll-px-4 snap-mandatory scroll-smooth flex gap-4 overflow-x-auto px-4 py-3 h-64"
>
	{#each $claimedCoupons as [coupon, balance] (coupon.publicKey)}
		<div class="snap-start shrink-0 card w-40 md:w-80">
			<ClaimedCouponCard {coupon} {balance}></ClaimedCouponCard>
		</div>
	{/each}
	{#if $claimedCoupons.length < 1}
		<p class="h2 text-secondary-400 my-auto mx-auto">👇🏼</p>
	{/if}
</div>

<!-- Market News -->
<header class="text-scrolling-container bg-surface-200-700-token sticky top-0 z-10 mt-3">
	<div class="text-scrolling">
		{#each news as [style, text]}
			<li class={style}>{text}</li>
		{/each}
	</div>
</header>

<!-- Market coupons -->
<div class="grid grid-cols-2 gap-4 px-4 py-4 mt-2">
	{#each $marketCoupons as [coupon, tokenAccount] (coupon.publicKey)}
		<MarketCouponCard {coupon} {tokenAccount}></MarketCouponCard>
	{/each}
</div>

<style>
	@keyframes scrollText {
		to {
			transform: translate(calc(-50% - 0.5rem));
		}
	}

	.text-scrolling-container {
		overflow: hidden;
		width: 100%;
		height: 3rem;
		display: flex;
	}

	.text-scrolling {
		margin-top: auto;
		margin-bottom: auto;
		width: max-content;
		display: flex;
		gap: 1rem;
		flex-direction: row;
		flex-wrap: nowrap;
		white-space: nowrap; /* Prevent text from wrapping to the next line */
		animation: scrollText 10s linear infinite; /* Adjust the duration and timing function as needed */
	}
</style>
