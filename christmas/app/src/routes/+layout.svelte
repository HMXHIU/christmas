<script lang="ts">
    import "../app.postcss";
    import { Button } from "$lib/components/ui/button";
    import * as Dialog from "$lib/components/ui/dialog";
    import { Dialog as BitsDialog } from "bits-ui";
    import * as AlertDialog from "$lib/components/ui/alert-dialog";
    import Wallet from "$lib/components/Wallet.svelte";
    import { userDeviceClient, token } from "../store";
    import { onMount } from "svelte";
    import {
        fetchClaimedCoupons,
        fetchMarketCoupons,
        fetchStores,
        verifyRedemption,
    } from "$lib/community";
    import { UserDeviceClient } from "$lib/clients/user-device-client/userDeviceClient";
    import QrScanner from "$lib/components/QRScanner.svelte";
    import { extractQueryParams, getErrorMessage } from "$lib/utils";
    import QrSvg from "$lib/components/svg/QrSvg.svelte";

    let qrAlertOpen: boolean = false;
    let verifyRemdeptionParams: any = {};

    async function fetchUserContent() {
        // TODO: put in their respective pages for more efficiency
        // Refetch market place coupons
        if (
            $userDeviceClient?.location?.country?.code &&
            $userDeviceClient?.location?.geohash
        ) {
            await fetchMarketCoupons({
                region: $userDeviceClient?.location?.country?.code,
                geohash: $userDeviceClient?.location?.geohash,
            });
        }
        await fetchClaimedCoupons();
        await fetchStores();
    }

    onMount(async () => {
        // fetch market coupons when userDeviceClient and anchorClient are ready
        userDeviceClient.subscribe(async (dc) => {
            if (dc && $token) {
                await fetchUserContent();
            }
        });
        token.subscribe(async (t) => {
            if (t && $userDeviceClient) {
                await fetchUserContent();
            }
        });

        // set userDeviceClient (Note: after subscribe)
        const client = new UserDeviceClient();
        await client.initialize();
        userDeviceClient.set(client);
    });

    async function onScanSuccess(decodedText: string, decodedResult: any) {
        const qrParams = extractQueryParams(decodedText);

        if (qrParams) {
            const { signature, mint, numTokens, wallet } = qrParams;

            // Verify redemption
            try {
                verifyRemdeptionParams = {
                    signature,
                    mint,
                    numTokens,
                    wallet,
                    verifyRedemption: await verifyRedemption({
                        signature,
                        mint,
                        numTokens,
                        wallet,
                    }),
                };
            } catch (err: any) {
                verifyRemdeptionParams = {
                    signature,
                    mint,
                    numTokens,
                    wallet,
                    verifyRedemption: {
                        isVerified: false,
                        err: err.message,
                    },
                };
            }

            // Open alert dialog
            qrAlertOpen = true;
        }
    }
</script>

<!-- App Shell -->
<div class="flex flex-col min-h-screen">
    <!-- Page Header -->
    <header class="sticky top-0 z-50 w-full border-b bg-secondary">
        <div class="container flex h-14 max-w-screen-2xl items-center">
            <div>
                <strong class="uppercase"><a href="/">Community</a></strong>
                <strong class="uppercase">///</strong>
                <strong class="uppercase"
                    ><a href="/crossover">Crossover</a></strong
                >
            </div>
            <div class="flex flex-1 items-center justify-end space-x-2">
                <Wallet></Wallet>
            </div>
        </div>
    </header>

    <!-- Page Content -->
    <main class="flex-grow">
        <!-- Your Page Content Goes Here -->
        <div class="container mx-auto px-0 py-8">
            <!-- Content Slot -->
            <slot />
        </div>
    </main>

    <!-- Page Footer -->
    <footer class="py-3 fixed w-full bottom-0 z-50 bg-secondary">
        <!-- QR Scanner -->
        <div class="relative h-0 flex justify-center">
            <Dialog.Root>
                <Dialog.Trigger>
                    <Button
                        size="icon"
                        variant="ghost"
                        class="relative w-14 h-14 -top-8 right: -right-[calc(50%-2rem)] rounded-full bg-secondary"
                    >
                        <QrSvg />
                    </Button>
                </Dialog.Trigger>
                <Dialog.Content>
                    <Dialog.Header>
                        <Dialog.Title class="flex justify-center p-4"
                            ><QrSvg /></Dialog.Title
                        >
                        <Dialog.Description>
                            Scan any community /// crossover related QR Code
                        </Dialog.Description>
                    </Dialog.Header>
                    <QrScanner {onScanSuccess} />
                    <Dialog.Footer>
                        <BitsDialog.Close class="w-full">
                            <Button>Close</Button>
                        </BitsDialog.Close>
                    </Dialog.Footer>
                </Dialog.Content>
            </Dialog.Root>
        </div>

        <!-- QR Scan Alert -->
        <AlertDialog.Root bind:open={qrAlertOpen}>
            <AlertDialog.Content>
                <AlertDialog.Header>
                    <AlertDialog.Title>Verifying Redemption</AlertDialog.Title>
                    <AlertDialog.Description>
                        {verifyRemdeptionParams.verifyRedemption.isVerified
                            ? `✅ Redemption Verified`
                            : `❌ ${getErrorMessage(
                                  verifyRemdeptionParams.verifyRedemption.err,
                              )}`}
                    </AlertDialog.Description>
                </AlertDialog.Header>
                {#if !verifyRemdeptionParams.verifyRedemption.isVerified}
                    <img
                        src="https://i.imgur.com/WOgTG96.gif"
                        alt="redemption unverified"
                    />
                {/if}
                <AlertDialog.Footer>
                    <AlertDialog.Cancel>Close</AlertDialog.Cancel>
                </AlertDialog.Footer>
            </AlertDialog.Content>
        </AlertDialog.Root>

        <!-- Coupons / Mint -->
        <div class="grid grid-cols-3 justify-center">
            <a href="/coupons" class="place-self-end">Coupons</a>
            <div></div>
            <a href="/mint" class="place-self-start">Mint</a>
        </div>
    </footer>
</div>
