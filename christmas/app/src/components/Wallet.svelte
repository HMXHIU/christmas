<script lang="ts">
    import type { AnchorWallet } from "@solana/wallet-adapter-react";
    import { PublicKey } from "@solana/web3.js";
    import { anchorClient, solana, token } from "../store";
    import { AnchorClient } from "$lib/clients/anchor-client/anchorClient";
    import { PROGRAM_ID } from "$lib/clients/anchor-client/defs";
    import { PUBLIC_RPC_ENDPOINT } from "$env/static/public";
    import type { ModalSettings } from "@skeletonlabs/skeleton";
    import { getModalStore } from "@skeletonlabs/skeleton";
    import DownloadWallet from "./DownloadWallet.svelte";
    import { onMount } from "svelte";

    const modalStore = getModalStore();
    let isConnected = false;

    // Only support phantom wallet for now
    function getProvider() {
        if ("phantom" in window) {
            const provider = (window as any).phantom.solana;
            if (provider?.isPhantom) {
                return provider;
            }
        }
        return null;
    }

    const downloadPhantomModal: ModalSettings = {
        type: "component",
        component: { ref: DownloadWallet },
    };

    async function handleLoginLogout() {
        // Ask user to download phantom wallet
        if ($solana == null) {
            modalStore.trigger(downloadPhantomModal);
        }
        // Connect & create anchorClient
        else if (!isConnected) {
            await connect();
        }
        // Disconnect
        else {
            await disconnect();
        }
    }

    async function signInWithSolana() {
        const solanaSignInInput = await (await fetch("/api/auth/siws")).json();
        const solanaSignInOutput = await $solana.signIn(solanaSignInInput);

        const { token } = await (
            await fetch("/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    solanaSignInInput,
                    solanaSignInOutput,
                }),
            })
        ).json();

        // set jwt token in store (fallback if cookies not allowed)
        $token = token;
    }

    async function connect() {
        await signInWithSolana(); // this will automatically connect to solana
        $anchorClient = new AnchorClient({
            programId: new PublicKey(PROGRAM_ID),
            anchorWallet: $solana as AnchorWallet,
            cluster: PUBLIC_RPC_ENDPOINT,
        });
        isConnected = true;
    }

    async function disconnect() {
        await $solana.disconnect();
        $anchorClient = null;
        $token = null;
        isConnected = false;
    }

    onMount(async () => {
        $solana = getProvider();
        isConnected = $solana.isConnected;
    });
</script>

<button type="button" class="btn variant-filled" on:click={handleLoginLogout}>
    {isConnected ? "Logout" : "Login"}
</button>
