<script lang="ts">
    import "../app.postcss";
    import {
        AppShell,
        AppBar,
        Modal,
        getModalStore,
        initializeStores,
    } from "@skeletonlabs/skeleton";
    import Wallet from "../components/Wallet.svelte";
    import { userDeviceClient, anchorClient } from "../store";
    import { onMount } from "svelte";
    import {
        fetchClaimedCoupons,
        fetchMarketCoupons,
        fetchStores,
        verifyRedemption,
    } from "$lib";
    import { UserDeviceClient } from "../../../lib/user-device-client/userDeviceClient";
    import type { ModalSettings } from "@skeletonlabs/skeleton";
    import QrScanner from "../components/QRScanner.svelte";

    // Skeleton (Modals)
    initializeStores();

    const modalStore = getModalStore();

    async function fetchUserContent() {
        // TODO: put in their respective pages for more efficiency
        await fetchMarketCoupons();
        await fetchClaimedCoupons();
        await fetchStores();
    }

    onMount(async () => {
        // fetch market coupons when userDeviceClient and anchorClient are ready
        userDeviceClient.subscribe(async (dc) => {
            if (dc && $anchorClient) {
                await fetchUserContent();
            }
        });
        anchorClient.subscribe(async (ac) => {
            if (ac && $userDeviceClient) {
                await fetchUserContent();
            }
        });

        // set userDeviceClient (Note: after subscribe)
        const client = new UserDeviceClient();
        await client.initialize();
        userDeviceClient.set(client);
    });

    function onQRScan() {
        new Promise<any>((resolve) => {
            const modal: ModalSettings = {
                type: "component",
                component: { ref: QrScanner },
                meta: {},
                response: async (result) => {
                    resolve(result);
                },
            };
            // Open modal
            modalStore.trigger(modal);
        })
            .then(async (qrParams) => {
                if (qrParams) {
                    const { signature, mint, numTokens, wallet } = qrParams;
                    return {
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
                }
                // close without resolving
                return null;
            })
            .then((result) => {
                modalStore.close();
                if (result) {
                    const { verifyRedemption, mint } = result;
                    const { isVerified, err } = verifyRedemption;
                    // Trigger another modal to show the validation result
                    modalStore.trigger({
                        type: "alert",
                        // Data
                        title: mint,
                        body: isVerified
                            ? `✅ Redemption Verified`
                            : `❌ ${err}`,
                        image: "https://i.imgur.com/WOgTG96.gif",
                    });
                }
            });
    }
</script>

<!-- Modal -->
<Modal />

<!-- App Shell -->
<AppShell slotFooter="">
    <!-- pageHeader -->
    <svelte:fragment slot="pageHeader">
        <!-- App Bar -->
        <AppBar>
            <svelte:fragment slot="lead">
                <strong class="text-xl uppercase"
                    ><a href="/">Community</a></strong
                >
            </svelte:fragment>
            <svelte:fragment slot="trail">
                <Wallet />
            </svelte:fragment>
        </AppBar>
    </svelte:fragment>

    <!-- pageFooter -->
    <svelte:fragment slot="footer">
        <!-- QR Scanner -->
        <div class="relative h-0">
            <button
                type="button"
                class="btn-icon bg-surface-800 relative w-14 -top-5 right: -right-[calc(50%-2rem)]"
                on:click={onQRScan}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="currentColor"
                    class="w-7 h-7 stroke-success-400"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z"
                    />
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M6.75 6.75h.75v.75h-.75v-.75ZM6.75 16.5h.75v.75h-.75v-.75ZM16.5 6.75h.75v.75h-.75v-.75ZM13.5 13.5h.75v.75h-.75v-.75ZM13.5 19.5h.75v.75h-.75v-.75ZM19.5 13.5h.75v.75h-.75v-.75ZM19.5 19.5h.75v.75h-.75v-.75ZM16.5 16.5h.75v.75h-.75v-.75Z"
                    />
                </svg>
            </button>
        </div>
        <AppBar
            gridColumns="grid-cols-3"
            slotLead="place-self-end"
            slotTrail="place-self-start"
            padding="p-3"
        >
            <!-- Coupons Page -->
            <svelte:fragment slot="lead">
                <a class="btn btn-sm variant-ghost-surface" href="/coupons">
                    Coupons
                </a>
            </svelte:fragment>
            <!-- Mint Page -->
            <svelte:fragment slot="trail">
                <a class="btn btn-sm variant-ghost-surface" href="/mint">
                    Mint
                </a>
            </svelte:fragment>
        </AppBar>
    </svelte:fragment>

    <!-- Page Route Content -->
    <slot />
</AppShell>
