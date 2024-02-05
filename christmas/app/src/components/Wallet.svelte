<script lang="ts">
    import { token } from "../store";
    import { getModalStore } from "@skeletonlabs/skeleton";
    import DownloadWallet from "./DownloadWallet.svelte";
    import { logIn, logOut } from "$lib";

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
</script>

<button type="button" class="btn variant-filled" on:click={handleLoginLogout}>
    {$token ? "Logout" : "Login"}
</button>
