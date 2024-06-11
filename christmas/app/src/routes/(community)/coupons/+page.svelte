<script lang="ts">
    import {
        claimCoupon,
        fetchClaimedCoupons,
        redeemCoupon,
        type ClaimCouponParams,
        type RedeemCouponParams,
    } from "$lib/community";
    import ClaimedCouponCard from "$lib/components/community/ClaimedCouponCard.svelte";
    import MarketCouponCard from "$lib/components/community/MarketCouponCard.svelte";

    import { generateURL } from "$lib/utils";
    import {
        claimedCoupons,
        marketCoupons,
        redeemedCoupons,
    } from "../../../store";

    // News
    let news = new Array();
    const today = new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    }).format(new Date());
    if ($marketCoupons.length < 1) {
        news.push(["", `Community Billboard - ${today}`]);
        news.push(["", "Anything to give to your community?"]);
        news.push(["", "Start by creating a store"]);
    } else {
        news.push(["", `${$marketCoupons.length} community coupons near you`]);
    }
    news.push([
        "text-error-400",
        "Beware of scams, visit your community store physically",
    ]);
    news = [...news, ...news]; // need double for wrap around scolling

    const haikus = [
        "Void whispers silence, Echoes in an empty heart, Lost, the soul departs",
        "Hollow, the spaces, Unseen shadows linger on, Emptiness, a song",
        "Barren fields of dreams, Desolation in the air, Silent echoes scream",
        "Empty rooms echo, Shadows dance in vacant halls, Loneliness enthralls",
        "A vacant vessel, Drifting in an empty sea, Lost eternity",
        "Deserted echoes, Empty whispers of the wind, Solitude within",
        "Silent night descends, Stars flicker in void's embrace, Loneliness transcends",
        "Absent footsteps fall, On barren paths of sorrow, Emptiness, a call",
        "Infinite void's gaze, Empty eyes reflect the void, Soulless, aching void",
        "Fallen autumn leaves, Whispers of the empty wind, Nature's void perceived",
    ];

    async function onClaimCoupon(claimCouponParams: ClaimCouponParams) {
        // Claim coupon
        await claimCoupon(claimCouponParams);
        // Refetch claimed coupons
        await fetchClaimedCoupons();
    }

    async function onRedeemCoupon(redeemCouponParams: RedeemCouponParams) {
        const { coupon, numTokens } = redeemCouponParams;

        // Redeem coupon
        const transactionResult = await redeemCoupon(redeemCouponParams);

        if (transactionResult.result.err == null) {
            // Generate redemptionQRCodeURL
            const redemptionQRCodeURL = generateURL({
                signature: transactionResult.signature,
                wallet: (window as any).solana.publicKey.toString(),
                mint: coupon.account.mint.toString(),
                numTokens: String(numTokens),
            });

            // Update `redeemedCoupons` store
            if (redemptionQRCodeURL) {
                redeemedCoupons.update((r) => {
                    r[coupon.publicKey.toString()] = redemptionQRCodeURL;
                    return r;
                });
            }
        }
    }
</script>

<!-- Claimed coupons -->
<div
    class="container scroll-container snap-x scroll-px-4 snap-mandatory scroll-smooth flex gap-4 overflow-x-auto px-4 py-3"
>
    {#each $claimedCoupons as [coupon, balance] (coupon.publicKey)}
        <div class="snap-start w-52 shrink-0 flex items-stretch">
            <ClaimedCouponCard {coupon} {balance} {onRedeemCoupon}
            ></ClaimedCouponCard>
        </div>
    {/each}
    {#if $claimedCoupons.length < 1}
        <p class="my-auto mx-auto text-center">
            You have not claimed any coupons<br /><br />
            <span class="italic text-muted-foreground">
                {haikus[Math.round(Math.random() * (haikus.length - 1))]}
            </span>
        </p>
    {/if}
</div>

<!-- Market News -->
<header
    class="text-scrolling-container sticky top-0 z-10 mt-3 bg-secondary w-full"
>
    <div class="text-scrolling">
        {#each news as [style, text]}
            <li class={style}>{text}</li>
        {/each}
    </div>
</header>

<!-- Market coupons -->
<div
    class="container grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 px-4 py-4 mt-2"
>
    {#each $marketCoupons as [coupon, balance] (coupon.publicKey)}
        <MarketCouponCard {coupon} {balance} {onClaimCoupon}></MarketCouponCard>
    {/each}
</div>
<div class="px-4 py-4 mt-2">
    {#if $marketCoupons.length < 1}
        <p class="mx-auto text-center">
            There are no community coupons in your area<br /><br />
            <span class="italic text-muted-foreground">
                {haikus[Math.round(Math.random() * haikus.length)]}
            </span>
        </p>
    {/if}
</div>

<!-- Styles -->
<style>
    @keyframes scrollText {
        to {
            transform: translate(calc(-50% - 0.5rem));
        }
    }

    .text-scrolling-container {
        overflow: hidden;
        width: 100%;
        height: 3rem;
        display: flex;
    }

    .text-scrolling {
        margin-top: auto;
        margin-bottom: auto;
        width: max-content;
        display: flex;
        gap: 1rem;
        flex-direction: row;
        flex-wrap: nowrap;
        white-space: nowrap; /* Prevent text from wrapping to the next line */
        animation: scrollText 10s linear infinite; /* Adjust the duration and timing function as needed */
    }

    /* Hide Scrollbar */
    .scroll-container {
        overflow-x: auto;
        scrollbar-width: none; /* Firefox */
        -ms-overflow-style: none; /* Internet Explorer 10+ */
    }
    .scroll-container::-webkit-scrollbar {
        display: none; /* WebKit */
    }
</style>
