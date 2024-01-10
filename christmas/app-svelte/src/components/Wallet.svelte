<script lang="ts">
	import { SolanaConnect } from 'solana-connect';
	import type { Adapter } from '@solana/wallet-adapter-base';

	const solConnect = new SolanaConnect();

	let display = 'Login';

	solConnect.onWalletChange((adapter: Adapter | null) => {
		if (adapter == null) {
			display = 'Login';
			console.log('disconnected');
		} else {
			display = 'Logout';
			console.log('connected:', adapter.name, adapter.publicKey?.toString());
		}
	});

	solConnect.onVisibilityChange((isOpen: boolean) => {
		console.log('menu visible:', isOpen);
	});

	const wallet: Adapter | null = solConnect.getWallet();
</script>

<button type="button" class="btn variant-filled" on:click={() => solConnect.openMenu()}
	>{display}</button
>
