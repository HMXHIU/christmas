<script lang="ts">
    import { anchorClient, token } from "../store";
    import { getModalStore } from "@skeletonlabs/skeleton";
    import DownloadWallet from "./DownloadWallet.svelte";
    import { logIn, logOut, refresh } from "$lib";
    import { onMount } from "svelte";
    import { AnchorClient } from "$lib/clients/anchor-client/anchorClient";
    import { PublicKey } from "@solana/web3.js";
    import { PROGRAM_ID } from "$lib/clients/anchor-client/defs";
    import type { AnchorWallet } from "@solana/wallet-adapter-react";
    import {
        PUBLIC_JWT_EXPIRES_IN,
        PUBLIC_RPC_ENDPOINT,
    } from "$env/static/public";

    const modalStore = getModalStore();

    async function handleLoginLogout() {
        // Ask user to download phantom wallet
        if ((window as any).solana == null) {
            modalStore.trigger({
                type: "component",
                component: { ref: DownloadWallet },
            });
        }
        // Connect & create anchorClient
        else if ($token == null) {
            try {
                await logIn();
            } catch (error: any) {
                await logOut();
                // Show login error
                modalStore.trigger({
                    type: "alert",
                    title: "We could not log you in. Please try again.",
                    body: `Login failed due to error: ${error.message}`,
                    image: "https://i.imgur.com/WOgTG96.gif",
                });
            }
        }
        // Disconnect
        else {
            await logOut();
        }
    }

    onMount(async () => {
        // Try to refresh token
        await refresh();

        // Auto connect if token is present
        if ($token != null) {
            // Token exists, user has connected before (domain should be whitelisted)
            await (window as any).solana.connect();

            // Create anchorClient
            $anchorClient = new AnchorClient({
                programId: new PublicKey(PROGRAM_ID),
                anchorWallet: (window as any).solana as AnchorWallet,
                cluster: PUBLIC_RPC_ENDPOINT,
            });

            // Set up refresh token interval (Note: Make sure Wallet is a singleton component, otherwise multiple intervals will be created)
            setInterval(
                refresh,
                parseInt(PUBLIC_JWT_EXPIRES_IN) * 1000 - 2000, // Refresh token 2 seconds before it expires
            );
        }
    });
</script>

<button type="button" class="btn variant-filled" on:click={handleLoginLogout}>
    {$token ? "Logout" : "Login"}
</button>
