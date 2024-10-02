<script lang="ts">
    import { fetchCouponMetadata } from "$lib/community";
    import type { Coupon, MintCoupon } from "$lib/community/types";
    import { couponsMetadata } from "../../../store";
    import BaseCouponCard from "./BaseCouponCard.svelte";
    import MintCouponDialog from "./MintCouponDialog.svelte";

    export let coupon: Coupon;
    export let balance: number;
    export let supply: number;
    export let onMintCoupon: (mintCouponParams: MintCoupon) => Promise<void>;
</script>

{#await fetchCouponMetadata(coupon) then}
    <BaseCouponCard
        couponName={coupon.name}
        couponDescription={$couponsMetadata[coupon.coupon].description}
        couponImageUrl={$couponsMetadata[coupon.coupon].image}
        {balance}
        {supply}
        expiry={coupon.validTo}
    >
        <div class="p-3 flex mx-auto my-auto">
            <MintCouponDialog {coupon} {onMintCoupon} />
        </div>
    </BaseCouponCard>
{/await}
