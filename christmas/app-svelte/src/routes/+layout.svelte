<script lang="ts">
	import '../app.postcss';
	import { AppShell, AppBar } from '@skeletonlabs/skeleton';
	import Wallet from '../components/Wallet.svelte';
</script>

<!-- App Shell -->
<AppShell>
	<!-- pageHeader -->
	<svelte:fragment slot="pageHeader">
		<!-- App Bar -->
		<AppBar>
			<svelte:fragment slot="lead">
				<strong class="text-xl uppercase">Community</strong>
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
				<a
					class="btn btn-sm variant-ghost-surface"
					href="/coupons"
					target="_blank"
					rel="noreferrer"
				>
					Coupons
				</a>
			</svelte:fragment>
			<svelte:fragment slot="trail">
				<a class="btn btn-sm variant-ghost-surface" href="/mint" target="_blank" rel="noreferrer">
					Mint
				</a>
			</svelte:fragment>
		</AppBar>
	</svelte:fragment>

	<!-- Page Route Content -->
	<slot />
</AppShell>
