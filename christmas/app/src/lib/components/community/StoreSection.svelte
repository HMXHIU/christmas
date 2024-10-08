<script lang="ts">
    import {
        createCoupon,
        fetchMarketCoupons,
        fetchMintedCouponSupplyBalance,
        fetchStoreMetadata,
        mintCoupon,
    } from "$lib/community";
    import {
        mintedCoupons,
        storesMetadata,
        userDeviceClient,
    } from "../../../store";
    import MintedCouponCard from "./MintedCouponCard.svelte";

    import type { CreateCoupon, MintCoupon, Store } from "$lib/community/types";
    import * as Avatar from "$lib/components/ui/avatar";
    import CreateCouponDialog from "./CreateCouponDialog.svelte";

    export let store: Store;

    async function fetchCoupons() {
        await fetchMintedCouponSupplyBalance(store.store);
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

    async function onCreateCoupon(createCouponParams: CreateCoupon) {
        await createCoupon(createCouponParams);
        // Refetch coupons
        await fetchCoupons();
    }

    async function onMintCoupon(mintCouponParams: MintCoupon) {
        // Mint coupon
        await mintCoupon(mintCouponParams);
        // Refetch coupons
        await fetchCoupons();
    }
</script>

{#await fetchStoreMetadata(store.store) then}
    <div class="flex flex-col">
        <!-- Store -->
        <header class="flex flex-row justify-between px-4 py-3 bg-secondary">
            <div class="flex flex-row space-x-3 my-auto">
                <!-- Logo -->
                <Avatar.Root class="my-auto">
                    <Avatar.Image
                        src={$storesMetadata[store.store].image}
                        alt={store.name}
                    />
                    <Avatar.Fallback>{store.name.slice(0, 2)}</Avatar.Fallback>
                </Avatar.Root>
                <div class="flex flex-col my-auto">
                    <!-- Name -->
                    <p class="text-base font-bold">
                        {store.name}
                    </p>
                    <!-- Address -->
                    <p class="text-sm font-light text-muted-foreground">
                        {$storesMetadata[store.store].address}
                    </p>
                    <!-- Description -->
                    <p class="text-xs italic pt-2 text-muted-foreground">
                        {$storesMetadata[store.store].description}
                    </p>
                </div>
            </div>
            <!-- Create Coupon -->
            <CreateCouponDialog {onCreateCoupon} {store} />
        </header>

        <!-- Coupons -->
        <div
            class="container grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 px-4 py-4 mt-2"
        >
            {#await fetchMintedCouponSupplyBalance(store.store) then}
                {#each $mintedCoupons[store.store.toString()] as [coupon, supply, balance]}
                    <MintedCouponCard {coupon} {balance} {supply} {onMintCoupon}
                    ></MintedCouponCard>
                {/each}
            {/await}
        </div>
    </div>
{/await}
