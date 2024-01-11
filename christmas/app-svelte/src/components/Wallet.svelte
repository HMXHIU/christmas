<script lang="ts">
	import type { AnchorWallet, Wallet } from '@solana/wallet-adapter-react';

	import { PublicKey } from '@solana/web3.js';

	import { anchorClient } from '../store';
	import { SolanaConnect } from 'solana-connect';
	import type { Adapter } from '@solana/wallet-adapter-base';
	import { AnchorClient } from '../../../lib/anchor-client/anchorClient';
	import { PROGRAM_ID } from '$lib/defs';

	const solConnect = new SolanaConnect();

	let display = 'Login';

	solConnect.onWalletChange((adapter: Adapter | null) => {
		if (adapter == null) {
			$anchorClient = null;
			display = 'Login';
			console.log('disconnected');
		} else {
			// set anchorClient
			$anchorClient = new AnchorClient({
				programId: new PublicKey(PROGRAM_ID),
				anchorWallet: adapter as AnchorWallet,
				wallet: {
					adapter,
					readyState: adapter?.readyState
				}
			});
			display = 'Logout';
			console.log('connected:', adapter.name, adapter.publicKey?.toString());
		}
	});
</script>

<button type="button" class="btn variant-filled" on:click={() => solConnect.openMenu()}
	>{display}</button
>
