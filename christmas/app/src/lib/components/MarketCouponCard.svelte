<script lang="ts">
    import { fetchCouponMetadata, fetchStoreMetadata } from "$lib/community";
    import type { Account, Coupon } from "$lib/anchorClient/types";
    import { calculateDistance, timeStampToDate } from "$lib/utils";
    import BaseCouponCard from "./BaseCouponCard.svelte";
    import { userDeviceClient } from "../../store";
    import type { ClaimCouponParams } from "$lib/community/types";
    import { Button } from "$lib/components/ui/button";
    import * as Dialog from "$lib/components/ui/dialog";
    import { Dialog as BitsDialog } from "bits-ui";
    import LoadingCoupon from "./LoadingCoupon.svelte";

    export let coupon: Account<Coupon>;
    export let balance: number;
    export let onClaimCoupon: (claimCouponParams: ClaimCouponParams) => void;

    let claimCouponOpen: boolean = false;
    let fetchMetadataAsync = fetchMetadata();

    async function fetchMetadata() {
        //sleep for 1 second
        await new Promise((r) => setTimeout(r, 3000));
        const couponMetadata = await fetchCouponMetadata(coupon);
        const storeMetadata = await fetchStoreMetadata(coupon.account.store);
        const distance = calculateDistance(
            storeMetadata.latitude,
            storeMetadata.longitude,
            $userDeviceClient!.location!.geolocationCoordinates!.latitude!,
            $userDeviceClient!.location!.geolocationCoordinates!.longitude!,
        );

        return { couponMetadata, storeMetadata, distance };
    }

    async function onClick() {
        await onClaimCoupon({
            numTokens: 1,
            coupon,
        });
        claimCouponOpen = false;
    }
</script>

{#await fetchMetadataAsync}
    <LoadingCoupon />
{:then { couponMetadata, storeMetadata, distance }}
    <!-- Claim Coupon Dialog -->
    <Dialog.Root bind:open={claimCouponOpen}>
        <Dialog.Trigger>
            <BaseCouponCard
                couponName={coupon.account.name}
                couponImageUrl={couponMetadata.image}
                storeName={storeMetadata.name}
                storeAddress={storeMetadata.address}
                storeImageUrl={storeMetadata.image}
                {distance}
                expiry={timeStampToDate(coupon.account.validTo)}
            ></BaseCouponCard>
        </Dialog.Trigger>
        <Dialog.Content class="sm:max-w-[425px]">
            <Dialog.Header>
                <Dialog.Title>Claim Coupon?</Dialog.Title>
                <Dialog.Description>
                    You may redeem this coupon at the store once you have
                    claimed it.
                </Dialog.Description>
            </Dialog.Header>
            <BaseCouponCard
                couponName={coupon.account.name}
                couponDescription={couponMetadata.description}
                couponImageUrl={couponMetadata.image}
                storeName={storeMetadata.name}
                storeAddress={storeMetadata.address}
                storeImageUrl={storeMetadata.image}
                {distance}
                remaining={balance}
                expiry={timeStampToDate(coupon.account.validTo)}
            ></BaseCouponCard>
            <Dialog.Footer class="flex flex-row justify-end gap-4">
                <BitsDialog.Close
                    ><Button>Maybe next time</Button></BitsDialog.Close
                >
                <Button type="submit" on:click={onClick}>Get it now</Button>
            </Dialog.Footer>
        </Dialog.Content>
    </Dialog.Root>
{/await}
