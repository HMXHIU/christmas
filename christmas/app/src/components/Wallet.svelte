<script lang="ts">
    import { token } from "../store";
    import { getModalStore } from "@skeletonlabs/skeleton";
    import DownloadWallet from "./DownloadWallet.svelte";
    import { login, logout, refresh } from "$lib/community";
    import { onMount } from "svelte";
    import { PUBLIC_JWT_EXPIRES_IN } from "$env/static/public";

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
                await login();
            } catch (error: any) {
                await logout();
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
            await logout();
        }
    }

    onMount(async () => {
        // Try to refresh token
        await refresh();

        // Auto connect if token is present
        if ($token != null) {
            // Token exists, user has connected before (domain should be whitelisted)
            await (window as any).solana.connect();

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
