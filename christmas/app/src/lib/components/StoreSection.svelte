<script lang="ts">
    import type { Account, Coupon, Store } from "$lib/anchorClient/types";
    import { cleanString } from "$lib/utils";
    import {
        fetchMarketCoupons,
        fetchMintedCouponSupplyBalance,
        fetchStoreMetadata,
        createCoupon,
    } from "$lib/community";
    import { Button } from "$lib/components/ui/button";

    import {
        mintedCoupons,
        storesMetadata,
        userDeviceClient,
    } from "../../store";
    import MintedCouponCard from "./MintedCouponCard.svelte";
    import { PublicKey } from "@solana/web3.js";
    import type { CreateCouponParams } from "$lib/community/types";
    import * as Avatar from "$lib/components/ui/avatar";
    import CouponSvg from "./svg/CouponSvg.svelte";
    import PlusSvg from "./svg/PlusSvg.svelte";
    import { Badge } from "$lib/components/ui/badge";
    import CreateCouponDialog from "./CreateCouponDialog.svelte";

    export let store: Account<Store>;

    const storeKey =
        store.publicKey instanceof PublicKey
            ? store.publicKey.toBase58()
            : store.publicKey;

    function createCouponModal() {
        // new Promise<CreateCouponParams>((resolve) => {
        //     const modal: ModalSettings = {
        //         type: "component",
        //         component: { ref: CreateCouponForm },
        //         meta: {},
        //         response: (values) => {
        //             resolve({ ...values, store });
        //         },
        //     };
        //     // Open modal
        //     modalStore.trigger(modal);
        // }).then(async (values) => {
        //     if (values) {
        //         // Create coupon
        //         await createCoupon(values);
        //         // Refetch coupons
        //         await fetchMintedCouponSupplyBalance(store.publicKey);
        //         // Refetch market place coupons
        //         if (
        //             $userDeviceClient?.location?.country?.code &&
        //             $userDeviceClient?.location?.geohash
        //         ) {
        //             await fetchMarketCoupons({
        //                 region: $userDeviceClient?.location?.country?.code,
        //                 geohash: $userDeviceClient?.location?.geohash,
        //             });
        //         }
        //     }
        // });
    }

    async function fetchCoupons() {
        await fetchMintedCouponSupplyBalance(store.publicKey);
        if (
            $userDeviceClient?.location?.country?.code &&
            $userDeviceClient?.location?.geohash
        ) {
            await fetchMarketCoupons({
                region: $userDeviceClient?.location?.country?.code,
                geohash: $userDeviceClient?.location?.geohash,
            });
        }
    }

    async function onCreateCoupon(createCouponParams: CreateCouponParams) {
        await createCoupon(createCouponParams);
        // Refetch coupons
        await fetchCoupons();
    }

    async function onMint(
        event: CustomEvent<{ numTokens: string; coupon: Account<Coupon> }>,
    ) {
        // Refetch coupons
        await fetchCoupons();
    }
</script>

{#await fetchStoreMetadata(store.publicKey) then}
    <div class="flex flex-col">
        <!-- Store -->
        <header class="flex flex-row justify-between px-4 py-3 bg-secondary">
            <div class="flex flex-row space-x-3 my-auto">
                <!-- Logo -->
                <Avatar.Root class="my-auto">
                    <Avatar.Image
                        src={$storesMetadata[storeKey].image}
                        alt={store.account.name}
                    />
                    <Avatar.Fallback
                        >{store.account.name.slice(2)}</Avatar.Fallback
                    >
                </Avatar.Root>
                <div class="flex flex-col my-auto">
                    <!-- Name -->
                    <p class="text-base font-bold">
                        {cleanString(store.account.name)}
                    </p>
                    <!-- Address -->
                    <p class="text-sm font-light text-muted-foreground">
                        {$storesMetadata[storeKey].address}
                    </p>
                    <!-- Description -->
                    <p class="text-xs italic pt-2 text-muted-foreground">
                        {$storesMetadata[storeKey].description}
                    </p>
                </div>
            </div>
            <!-- Create Coupon -->
            <CreateCouponDialog {onCreateCoupon} {store} />
        </header>

        <!-- Coupons -->
        <div class="grid grid-cols-2 gap-4 px-4 py-4 mt-2">
            {#await fetchMintedCouponSupplyBalance(store.publicKey) then}
                {#each $mintedCoupons[store.publicKey.toString()] as [coupon, supply, balance]}
                    <MintedCouponCard
                        {coupon}
                        {balance}
                        {supply}
                        on:mint={onMint}
                    ></MintedCouponCard>
                {/each}
            {/await}
        </div>
    </div>
{/await}
