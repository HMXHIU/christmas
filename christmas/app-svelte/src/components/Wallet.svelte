<script lang="ts">
	import type { AnchorWallet } from '@solana/wallet-adapter-react';
	import { PublicKey } from '@solana/web3.js';
	import { anchorClient, solanaConnect } from '../store';
	import { SolanaConnect } from 'solana-connect';
	import type { Adapter } from '@solana/wallet-adapter-base';
	import { AnchorClient } from '../../../lib/anchor-client/anchorClient';
	import { PROGRAM_ID } from '../../../lib/anchor-client/defs';
	import { onMount } from 'svelte';

	onMount(async () => {
		$solanaConnect = new SolanaConnect();
		$solanaConnect!.onWalletChange((adapter: Adapter | null) => {
			if (adapter == null) {
				$anchorClient = null;
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
				console.log('connected:', adapter.name, adapter.publicKey?.toString());
			}
		});
	});
</script>

<button type="button" class="btn variant-filled" on:click={() => $solanaConnect?.openMenu()}
	>{$anchorClient ? 'Logout' : 'Login'}</button
>
