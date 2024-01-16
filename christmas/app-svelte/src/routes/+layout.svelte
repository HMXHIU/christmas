<script lang="ts">
	import '../app.postcss';
	import { AppShell, AppBar } from '@skeletonlabs/skeleton';
	import Wallet from '../components/Wallet.svelte';
	import { userDeviceClient, anchorClient } from '../store';
	import { onMount } from 'svelte';
	import { fetchClaimedCoupons, fetchMarketCoupons, fetchStores } from '$lib';
	import { UserDeviceClient } from '../../../lib/user-device-client/userDeviceClient';
	import { initializeStores } from '@skeletonlabs/skeleton';
	import { Modal } from '@skeletonlabs/skeleton';

	// Skeleton (Modals)
	initializeStores();

	async function fetchUserContent() {
		// TODO: put in their respective pages for more efficiency
		await fetchMarketCoupons();
		await fetchClaimedCoupons();
		await fetchStores();
	}

	onMount(async () => {
		// set userDeviceClient
		const client = new UserDeviceClient();
		await client.initialize();
		userDeviceClient.update(() => client);

		// fetch market coupons when userDeviceClient and anchorClient are ready
		userDeviceClient.subscribe(async (dc) => {
			if (dc && $anchorClient) {
				await fetchUserContent();
			}
		});
		anchorClient.subscribe(async (ac) => {
			if (ac && $userDeviceClient) {
				await fetchUserContent();
			}
		});
	});
</script>

<!-- Modal -->
<Modal />

<!-- App Shell -->
<AppShell>
	<!-- pageHeader -->
	<svelte:fragment slot="pageHeader">
		<!-- App Bar -->
		<AppBar>
			<svelte:fragment slot="lead">
				<strong class="text-xl uppercase"><a href="/">Community</a></strong>
			</svelte:fragment>
			<svelte:fragment slot="trail">
				<Wallet />
			</svelte:fragment>
		</AppBar>
	</svelte:fragment>

	<!-- pageFooter -->
	<svelte:fragment slot="footer">
		<AppBar gridColumns="grid-cols-3" slotLead="place-self-end" slotTrail="place-self-start">
			<svelte:fragment slot="lead">
				<a class="btn btn-sm variant-ghost-surface" href="/coupons"> Coupons </a>
			</svelte:fragment>
			<svelte:fragment slot="trail">
				<a class="btn btn-sm variant-ghost-surface" href="/mint"> Mint </a>
			</svelte:fragment>
		</AppBar>
	</svelte:fragment>

	<!-- Page Route Content -->
	<slot />
</AppShell>
