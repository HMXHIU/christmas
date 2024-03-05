<script lang="ts">
    import BaseCouponCard from "./BaseCouponCard.svelte";

    import type { Account, Coupon } from "$lib/anchorClient/types";
    import { fetchCouponMetadata } from "$lib/community";
    import { timeStampToDate } from "$lib/utils";
    import { couponsMetadata } from "../../../store";

    import MintCouponDialog from "./MintCouponDialog.svelte";
    import type { MintCouponParams } from "./types";

    export let coupon: Account<Coupon>;
    export let balance: number;
    export let supply: number;

    export let onMintCoupon: (
        mintCouponParams: MintCouponParams,
    ) => Promise<void>;

    const couponKey = coupon.publicKey.toString();
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
        <div class="p-3 flex mx-auto my-auto">
            <MintCouponDialog {coupon} {supply} {balance} {onMintCoupon} />
        </div>
    </BaseCouponCard>
{/await}
