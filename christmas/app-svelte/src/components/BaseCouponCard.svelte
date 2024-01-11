<script lang="ts">
	import { cleanString } from '../../../lib/anchor-client/utils';
	import { Avatar } from '@skeletonlabs/skeleton';

	export let couponName: string;
	export let expiry: Date;
	export let couponImageUrl: string | null = null;
	export let remaining: number | null = null;
	export let distance: number | null = null;
	export let storeImageUrl: string | null = null;
	export let storeName: string | null = null;
	export let storeAddress: string | null = null;

	function getDistance(distance: number): string {
		if (distance) {
			if (distance < 0.1) {
				return 'nearby';
			} else if (distance < 1) {
				return `${Math.trunc(distance * 1000)}m`;
			}
			return `${Math.round(distance)}km`;
		}
		return '';
	}
</script>

<div class="card flex flex-col">
	<header class="card-header p-0 grow">
		<!-- Image -->
		{#if couponImageUrl}
			<img class="coupon-image w-full" src={couponImageUrl} alt="coupon" />
		{:else}
			<div class="empty-image">
				<sl-icon name="image-fill"></sl-icon>
			</div>
		{/if}
	</header>
	<section class="p-4 flex-none">
		<!-- Coupon Name -->
		<p class="text-sm">{cleanString(couponName)}</p>
		<!-- Expiry -->
		<p class="text-xs">
			Expires
			{new Intl.DateTimeFormat('en-US', {
				year: 'numeric',
				month: 'long',
				day: 'numeric'
			}).format(expiry)}
		</p>
		<!-- Remaining -->
		{#if remaining}
			<p class="text-xs">
				{remaining} remaining
			</p>
		{/if}
	</section>
	{#if storeName}
		<!-- Store -->
		<footer class="card-footer flex flex-row flex-none">
			<div class="flex flex-col">
				<!-- Store Image -->
				{#if storeImageUrl != null}
					<Avatar src={storeImageUrl} width="w-16" rounded="rounded-full" />
				{:else}
					<Avatar initials={storeName.slice(2)} width="w-16" rounded="rounded-full" />
				{/if}
			</div>
			<div>
				<p class="text-sm">{storeName}</p>
				<p class="text-xs">{storeAddress}</p>
				<!-- Distance -->
				{#if distance}
					<p class="text-xs">{getDistance(distance)}</p>
				{/if}
			</div>
		</footer>
	{/if}
</div>

<style>
</style>
