<script lang="ts">
    import type { AnchorWallet } from "@solana/wallet-adapter-react";
    import { PublicKey } from "@solana/web3.js";
    import { anchorClient, solana } from "../store";
    import { AnchorClient } from "$lib/clients/anchor-client/anchorClient";
    import { PROGRAM_ID } from "$lib/clients/anchor-client/defs";
    import { PUBLIC_RPC_ENDPOINT } from "$env/static/public";
    import type { ModalSettings } from "@skeletonlabs/skeleton";
    import { getModalStore } from "@skeletonlabs/skeleton";
    import DownloadWallet from "./DownloadWallet.svelte";
    import { onMount } from "svelte";

    // Only support phantom wallet for now
    const modalStore = getModalStore();
    let isConnected = false;

    onMount(async () => {
        $solana = getProvider();
        isConnected = $solana.isConnected;
    });

    const downloadPhantomModal: ModalSettings = {
        type: "component",
        component: { ref: DownloadWallet },
    };

    async function handleLoginLogout() {
        // Ask user to download phantom wallet
        if ($solana == null) {
            $anchorClient = null;
            modalStore.trigger(downloadPhantomModal);
        }
        // Connect & create anchorClient
        else if (!isConnected) {
            await $solana.connect();
            isConnected = true;
            $anchorClient = new AnchorClient({
                programId: new PublicKey(PROGRAM_ID),
                anchorWallet: $solana as AnchorWallet,
                cluster: PUBLIC_RPC_ENDPOINT,
            });
        }
        // Disconnect
        else {
            await $solana.disconnect();
            isConnected = false;
            $anchorClient = null;
        }
    }

    function getProvider() {
        if ("phantom" in window) {
            const provider = window.phantom?.solana;
            if (provider?.isPhantom) {
                return provider;
            }
        }
        return null;
    }
</script>

<button type="button" class="btn variant-filled" on:click={handleLoginLogout}>
    {isConnected ? "Logout" : "Login"}
</button>
