<script lang="ts">
	import { cleanString } from '../../../lib/anchor-client/utils';
	import { Avatar } from '@skeletonlabs/skeleton';

	export let couponName: string;
	export let expiry: Date;
	export let couponDescription: string | null = null;
	export let couponImageUrl: string | null = null;
	export let remaining: number | null = null;
	export let distance: number | null = null;
	export let storeImageUrl: string | null = null;
	export let storeName: string | null = null;
	export let storeAddress: string | null = null;
	export let redemptionQRCodeURL: string | null = null;

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

<div class="card flex flex-col h-full overflow-hidden">
	<header class="card-header p-0 grow">
		<!-- Image -->
		<div class="overflow-hidden relative max-h-36">
			{#if couponImageUrl}
				<img
					class="coupon-image w-full {redemptionQRCodeURL ? 'blur-lg' : ''}"
					src={couponImageUrl}
					alt="coupon"
				/>
			{:else if redemptionQRCodeURL == null}
				<div class="empty-image">
					<sl-icon name="image-fill"></sl-icon>
				</div>
			{/if}
			{#if redemptionQRCodeURL}
				<div
					class="btn-icon variant-filled absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-1"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						stroke-width="1.5"
						stroke="currentColor"
						class="w-6 h-6"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z"
						/>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M6.75 6.75h.75v.75h-.75v-.75ZM6.75 16.5h.75v.75h-.75v-.75ZM16.5 6.75h.75v.75h-.75v-.75ZM13.5 13.5h.75v.75h-.75v-.75ZM13.5 19.5h.75v.75h-.75v-.75ZM19.5 13.5h.75v.75h-.75v-.75ZM19.5 19.5h.75v.75h-.75v-.75ZM16.5 16.5h.75v.75h-.75v-.75Z"
						/>
					</svg>
				</div>
			{/if}
		</div>
		<!-- Expiry -->
		<p class="text-xs italic text-right text-primary-50 text-opacity-50 mt-1 mr-1">
			Expires
			{new Intl.DateTimeFormat('en-US', {
				year: 'numeric',
				month: 'long',
				day: 'numeric'
			}).format(expiry)}
		</p>
		<!-- Distance -->
		{#if distance}
			<p class="text-xs text-right text-success-400 mt-1 mr-1">
				{getDistance(distance)}
			</p>
		{/if}
		<!-- Remaining -->
		{#if remaining}
			<p class="text-xs italic text-right text-primary-50 text-opacity-50 mt-1 mr-1">
				{remaining} remaining
			</p>
		{/if}
	</header>
	<section class="p-3 flex-none">
		<!-- Coupon Name -->
		<p class="text-base font-bold">{cleanString(couponName)}</p>
		<!-- Coupon Description -->
		{#if couponDescription}
			<p class="text-base">{cleanString(couponDescription)}</p>
		{/if}
	</section>
	{#if storeName}
		<!-- Store -->
		<footer class="card-footer flex flex-row flex-none p-3">
			<div class="flex flex-col mr-2 my-auto">
				<!-- Store Image -->
				{#if storeImageUrl != null}
					<Avatar src={storeImageUrl} width="w-16" rounded="rounded-full" />
				{:else}
					<Avatar initials={storeName.slice(2)} width="w-16" rounded="rounded-full" />
				{/if}
			</div>
			<div class="overflow-hidden my-auto">
				<!-- Store Name -->
				<p class="text-sm font-bold">{storeName}</p>
				<!-- Store Address -->
				<p class="text-xs text-ellipsis text-nowrap overflow-hidden">{storeAddress}</p>
			</div>
		</footer>
	{/if}
</div>
