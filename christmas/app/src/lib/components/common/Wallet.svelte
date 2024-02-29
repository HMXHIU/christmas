<script lang="ts">
    import { token } from "../../../store";
    import { login, logout, refresh } from "$lib/community";
    import { onMount } from "svelte";
    import { PUBLIC_JWT_EXPIRES_IN } from "$env/static/public";

    import * as AlertDialog from "$lib/components/ui/alert-dialog";
    import { Button } from "$lib/components/ui/button";
    import { getErrorMessage } from "$lib/utils";

    let showDownloadWalletAlert: boolean = false;
    let showLoginErrorAlert: boolean = false;
    let loginError: string = "";

    async function handleLoginLogout() {
        // Ask user to download phantom wallet
        if (window.solana == null) {
            showDownloadWalletAlert = true;
        }
        // Login solana
        else if ($token == null) {
            try {
                await login();
            } catch (error: any) {
                await logout();
                loginError = getErrorMessage(error);
                showLoginErrorAlert = true;
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
            await window.solana.connect();

            // Set up refresh token interval (Note: Make sure Wallet is a singleton component, otherwise multiple intervals will be created)
            setInterval(
                refresh,
                parseInt(PUBLIC_JWT_EXPIRES_IN) * 1000 - 2000, // Refresh token 2 seconds before it expires
            );
        }
    });
</script>

<!-- Download Wallet Alert -->
<AlertDialog.Root bind:open={showDownloadWalletAlert}>
    <AlertDialog.Content>
        <AlertDialog.Header>
            <AlertDialog.Title>Download Phantom Wallet</AlertDialog.Title>
            <img
                src="https://3632261023-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MVOiF6Zqit57q_hxJYp%2Fuploads%2FHEjleywo9QOnfYebBPCZ%2FPhantom_SVG_Icon.svg?alt=media&token=71b80a0a-def7-4f98-ae70-5e0843fdaaec"
                alt="Phantom Wallet"
                class="h-64 p-4"
            />
            <AlertDialog.Description>
                You need a Web3 wallet to proceed.<br /><br />This serves as
                your digital identiy and holds your digital assets.<br /><br
                />We currently only suport Phantom Wallet.
            </AlertDialog.Description>
        </AlertDialog.Header>
        <Button href="https://phantom.app/" class="w-full" target="_blank"
            >Download Phantom Wallet</Button
        >
        <AlertDialog.Footer>
            <AlertDialog.Cancel>Close</AlertDialog.Cancel>
        </AlertDialog.Footer>
    </AlertDialog.Content>
</AlertDialog.Root>

<!-- Login Error Alert -->
<AlertDialog.Root bind:open={showLoginErrorAlert}>
    <AlertDialog.Content>
        <AlertDialog.Header>
            <AlertDialog.Title
                >We could not log you in. Please try again.</AlertDialog.Title
            >
            <AlertDialog.Description>
                {`Login failed due to error: ${loginError}`}
            </AlertDialog.Description>
        </AlertDialog.Header>
        <img
            src="https://i.imgur.com/WOgTG96.gif"
            alt="redemption unverified"
        />
        <AlertDialog.Footer>
            <AlertDialog.Cancel>Close</AlertDialog.Cancel>
        </AlertDialog.Footer>
    </AlertDialog.Content>
</AlertDialog.Root>

<Button on:click={handleLoginLogout} variant="outline">
    {$token ? "Logout" : "Login"}
</Button>
