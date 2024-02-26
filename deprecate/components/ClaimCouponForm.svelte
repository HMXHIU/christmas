<script lang="ts">
    import type { SvelteComponent } from "svelte";
    import { getModalStore } from "@skeletonlabs/skeleton";
    import BaseCouponCard from "./BaseCouponCard.svelte";
    import type { Account, Coupon } from "$lib/anchorClient/types";

    import type { CouponMetadata, StoreMetadata } from "$lib/community/types";
    import { timeStampToDate } from "$lib/utils";

    export let parent: SvelteComponent;

    const modalStore = getModalStore();

    let coupon: Account<Coupon> = $modalStore[0].meta.coupon;
    let couponMetadata: CouponMetadata = $modalStore[0].meta.couponMetadata;
    let storeMetadata: StoreMetadata = $modalStore[0].meta.storeMetadata;
    let distance: number = $modalStore[0].meta.distance;
    let balance: number = $modalStore[0].meta.balance;

    function onClaimCoupon(): void {
        if ($modalStore[0].response)
            $modalStore[0].response({
                numTokens: 1,
                coupon,
            });
        modalStore.close();
    }
</script>

{#if $modalStore[0]}
    <div class="card w-modal shadow-xl">
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

        <footer class="modal-footer p-4 {parent.regionFooter}">
            <button class="btn {parent.buttonNeutral}" on:click={parent.onClose}
                >Maybe next time</button
            >
            <button class="btn {parent.buttonPositive}" on:click={onClaimCoupon}
                >Get it now</button
            >
        </footer>
    </div>
{/if}
