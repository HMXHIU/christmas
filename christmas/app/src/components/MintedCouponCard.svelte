<script lang="ts">
    import BaseCouponCard from "./BaseCouponCard.svelte";
    import MintCouponForm from "./MintCouponForm.svelte";
    import type { ModalSettings } from "@skeletonlabs/skeleton";

    import type { Account, Coupon } from "$lib/anchorClient/types";
    import { timeStampToDate } from "$lib/utils";
    import { couponsMetadata } from "../store";
    import { fetchCouponMetadata, mintCoupon } from "$lib/community";
    import { getModalStore } from "@skeletonlabs/skeleton";
    import { createEventDispatcher } from "svelte";

    const dispatch = createEventDispatcher();

    const modalStore = getModalStore();

    export let coupon: Account<Coupon>;
    export let balance: number;
    export let supply: number;
    const couponKey = coupon.publicKey.toString();

    function mintCouponModal() {
        new Promise<{ numTokens: number }>((resolve) => {
            const modal: ModalSettings = {
                type: "component",
                component: { ref: MintCouponForm },
                meta: {
                    coupon,
                    balance,
                    supply,
                },
                response: async (values) => {
                    resolve(values);
                },
            };
            // Open modal
            modalStore.trigger(modal);
        }).then(async ({ numTokens }) => {
            if (numTokens) {
                // Mint coupon
                await mintCoupon({ coupon, numTokens });

                // dispatch on:mint
                dispatch("mint", { coupon, numTokens });
            }
        });
    }
</script>

{#await fetchCouponMetadata(coupon) then}
    <BaseCouponCard
        couponName={coupon.account.name}
        couponDescription={$couponsMetadata[couponKey].description}
        couponImageUrl={$couponsMetadata[couponKey].image}
        {balance}
        {supply}
        expiry={timeStampToDate(coupon.account.validTo)}
    >
        <button
            type="button"
            class="btn variant-filled mx-3 mt-3"
            on:click={mintCouponModal}>Add Supply</button
        >
    </BaseCouponCard>
{/await}
