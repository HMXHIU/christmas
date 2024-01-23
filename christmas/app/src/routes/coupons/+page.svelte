<script lang="ts">
    import ClaimedCouponCard from "../../components/ClaimedCouponCard.svelte";
    import MarketCouponCard from "../../components/MarketCouponCard.svelte";
    import {
        marketCoupons,
        claimedCoupons,
        userDeviceClient,
        anchorClient,
    } from "../../store";

    // News
    let news = new Array();
    const today = new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    }).format(new Date());
    if ($marketCoupons.length < 1) {
        news.push(["text-success-400", `Community Billboard - ${today}`]);
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

    function createUser() {
        const url = `${window.location.origin}/api/solana-pay`; // replace with your actual URL
        const data = {
            // your data here
            procedure: "createUser",
            parameters: {
                wallet: $anchorClient?.anchorWallet.publicKey.toString(),
                geohash: $userDeviceClient?.location.geohash,
                region: $userDeviceClient?.location.country?.code,
            },
        };

        fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
        })
            .then((response) => response.json())
            .then((data) => console.log(data))
            .catch((error) => {
                console.error("Error:", error);
            });
    }
</script>

<!-- Claimed coupons -->
<div
    class="snap-x scroll-px-4 snap-mandatory scroll-smooth flex gap-4 overflow-x-auto px-4 py-3 h-64"
>
    {#each $claimedCoupons as [coupon, balance] (coupon.publicKey)}
        <div class="snap-start shrink-0 card w-40 md:w-80">
            <ClaimedCouponCard {coupon} {balance}></ClaimedCouponCard>
        </div>
    {/each}
    {#if $claimedCoupons.length < 1}
        <p class="text-surface-300 my-auto mx-auto text-center">
            Your claimed coupons goes here<br /><br />
            <span class="italic text-surface-400">
                {haikus[Math.round(Math.random() * (haikus.length - 1))]}
            </span>
        </p>
    {/if}
</div>

<button
    class="btn-icon bg-surface-800 relative w-14 -top-5 right: -right-[calc(50%-2rem)]"
    on:click={createUser}
>
    Create User
</button>

<!-- Market News -->
<header
    class="text-scrolling-container bg-surface-200-700-token sticky top-0 z-10 mt-3"
>
    <div class="text-scrolling">
        {#each news as [style, text]}
            <li class={style}>{text}</li>
        {/each}
    </div>
</header>

<!-- Market coupons -->
<div class="grid grid-cols-2 gap-4 px-4 py-4 mt-2">
    {#each $marketCoupons as [coupon, tokenAccount] (coupon.publicKey)}
        <MarketCouponCard {coupon} {tokenAccount}></MarketCouponCard>
    {/each}
</div>
<div class="px-4 py-4 mt-2">
    {#if $marketCoupons.length < 1}
        <p class="text-surface-300 mx-auto text-center">
            There are no community coupons in your area<br /><br />
            <span class="italic text-surface-400">
                {haikus[Math.round(Math.random() * haikus.length)]}
            </span>
        </p>
    {/if}
</div>

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
</style>
