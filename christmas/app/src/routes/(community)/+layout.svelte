<script lang="ts">
    import {
        fetchClaimedCoupons,
        fetchMarketCoupons,
        fetchStores,
    } from "$lib/community";
    import Footer from "$lib/components/community/Footer.svelte";
    import { onMount } from "svelte";
    import "../../app.postcss";
    import { token, userDeviceClient } from "../../store";

    async function fetchUserContent() {
        // Refetch market place coupons
        if (
            $userDeviceClient?.location?.country?.code &&
            $userDeviceClient?.location?.geohash
        ) {
            console.log("Fetching market coupons");
            await fetchMarketCoupons({
                region: $userDeviceClient?.location?.country?.code,
                geohash: $userDeviceClient?.location?.geohash,
            });
        }
        await fetchClaimedCoupons();
        await fetchStores();
    }

    onMount(async () => {
        // Fetch market coupons when userDeviceClient changes
        userDeviceClient.subscribe(async (dc) => {
            if (dc && $token) {
                await fetchUserContent();
            }
        });
        token.subscribe(async (t) => {
            if (t && $userDeviceClient) {
                await fetchUserContent();
            }
        });
    });
</script>

<!-- Page Content (account for footer) -->
<div class="pb-12 pt-4">
    <!-- Slot -->
    <slot></slot>
</div>

<!-- Footer -->
<Footer />
