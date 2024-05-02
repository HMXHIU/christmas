<script lang="ts">
    import {
        fetchClaimedCoupons,
        fetchMarketCoupons,
        fetchStores,
        verifyRedemption,
    } from "$lib/community";
    import Wallet from "$lib/components/common/Wallet.svelte";
    import { Toaster } from "$lib/components/ui/sonner";
    import { UserDeviceClient } from "$lib/userDeviceClient";
    import { extractQueryParams } from "$lib/utils";
    import { onMount } from "svelte";
    import "../app.postcss";
    import { token, userDeviceClient } from "../store";

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
        // Fetch market coupons when userDeviceClient changes
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
        // Set userDeviceClient (Note: after subscribe)
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
                        numTokens: parseInt(numTokens),
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
<div class="flex flex-col h-dvh">
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
    <main style="height: calc(100dvh - 7rem);">
        <!-- Your Page Content Goes Here -->
        <div class="mx-auto px-0 py-0 h-full">
            <!-- Content Slot -->
            <slot />
        </div>
    </main>

    <!-- Toaster -->
    <Toaster />
</div>
