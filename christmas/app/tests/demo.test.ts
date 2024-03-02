import {
    createCoupon,
    createStore,
    fetchMintedCouponSupplyBalance,
    fetchStores,
    mintCoupon,
} from "$lib/community";
import type { CouponMetadata, StoreMetadata } from "$lib/community/types";
import { stringToUint8Array } from "$lib/utils";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { Keypair } from "@solana/web3.js";
import ngeohash from "ngeohash";
import { expect, test } from "vitest";
import { getCookiesFromResponse, login, readImageAsBuffer } from "./utils";

test(
    "Generate demo content",
    async () => {
        const user = Keypair.generate();
        const userWallet = new NodeWallet(user);

        // Locations (https://geohash.softeng.co/w21z3w)
        // const geoHere = Array.from(stringToUint8Array("w21z98")); // faber heights
        // const geoHere = Array.from(stringToUint8Array("w21z71")); // metacamp
        const geoHere = Array.from(stringToUint8Array("w21z4w")); // harbour front
        // const geoHere = Array.from(stringToUint8Array("w21z3p")); // clementi mall
        const regionCode = "SGP";
        const region = Array.from(stringToUint8Array(regionCode));
        const { latitude, longitude } = ngeohash.decode(
            String.fromCharCode(...geoHere),
        );

        // Dates
        const today = new Date();
        const afterToday = new Date(today);
        afterToday.setMonth(afterToday.getMonth() + 3);
        const beforeToday = new Date(today);
        beforeToday.setMonth(beforeToday.getMonth() - 3);

        // Stores and coupons
        const demoStoresCoupons: {
            couponMetadata: CouponMetadata;
            storeMetadata: StoreMetadata;
        }[] = [
            {
                couponMetadata: {
                    name: "SereneSpa",
                    description:
                        "Unwind with our exclusive spa coupon! Indulge in blissful relaxation and pamper yourself. Your escape to tranquility awaits.",
                    image: "../static/demo/assets/coupon_spa.jpeg",
                },
                storeMetadata: {
                    name: "SereneSpa Emporium",
                    description:
                        "Discover a haven of serenity at SereneSpa Emporium. Your one-stop destination for luxurious spa essentials and wellness treasures.",
                    image: "../static/demo/assets/coupon_spa.jpeg",
                    address: "123 Tranquil Lane, Blissful City, Zenland",
                    latitude,
                    longitude,
                },
            },
            {
                couponMetadata: {
                    name: "LuxeLotion",
                    description:
                        "Dive into luxury with our lotion coupon. Silky smoothness meets rejuvenation. Nourish your skin and elevate your self-care routine.",
                    image: "../static/demo/assets/coupon_lotion.jpeg",
                },
                storeMetadata: {
                    name: "Luxurious Lotions Boutique",
                    description:
                        "Indulge in the finest lotions at Luxurious Lotions Boutique. Elevate your skincare ritual with our curated collection of luxurious products.",
                    image: "../static/demo/assets/coupon_lotion.jpeg",
                    address: "456 Opulence Street, Radiant Town, Glowville",
                    latitude,
                    longitude,
                },
            },
            {
                couponMetadata: {
                    name: "GiftGlow",
                    description:
                        "Exclusively for you - a free gift! Elevate your pampering routine with a complimentary surprise. Because you deserve a little extra joy.",
                    image: "../static/demo/assets/coupon_free_gift.jpeg",
                },
                storeMetadata: {
                    name: "Glowing Gifts Emporium",
                    description:
                        "Find joy in every gift at Glowing Gifts Emporium. Discover a world of surprises that illuminate your senses.",
                    image: "../static/demo/assets/coupon_free_gift.jpeg",
                    address: "789 Radiance Avenue, Joyful City, Blissland",
                    latitude,
                    longitude,
                },
            },
            {
                couponMetadata: {
                    name: "CyberZen",
                    description:
                        "Dive into the digital spa experience with our cyber coupon. Immerse yourself in wellness, tech style. Upgrade your self-care game now.",
                    image: "../static/demo/assets/coupon_cyber.jpeg",
                },
                storeMetadata: {
                    name: "ZenTech Wellness Hub",
                    description:
                        "Experience wellness in the digital age at ZenTech Wellness Hub. Your journey to CyberZen begins here.",
                    image: "../static/demo/assets/coupon_cyber.jpeg",
                    address: "101 Digital Drive, Tech Town, Silicon Zen",
                    latitude,
                    longitude,
                },
            },
            {
                couponMetadata: {
                    name: "VinoVibes",
                    description:
                        "Sip, relax, and save with our wine coupon. A toast to indulgence! Uncork the moments of joy and elevate your spa experience.",
                    image: "../static/demo/assets/coupon_wine.jpeg",
                },
                storeMetadata: {
                    name: "VinoVibes Cellars",
                    description:
                        "Raise your glass to joy at VinoVibes Cellars. Explore a world of exquisite wines that enhance your spa experience.",
                    image: "../static/demo/assets/coupon_wine.jpeg",
                    address: "321 Vineyard Street, Cheersville, Wineland",
                    latitude,
                    longitude,
                },
            },
            {
                couponMetadata: {
                    name: "PurrfectSpa",
                    description:
                        "Embrace tranquility with our cat-inspired spa coupon. Your feline companion for relaxation. Unwind in the purrfect spa ambiance.",
                    image: "../static/demo/assets/coupon_cat.jpeg",
                },
                storeMetadata: {
                    name: "Purrfect Relaxation Haven",
                    description:
                        "Find tranquility in the company of feline friends at Purrfect Relaxation Haven. Your ultimate destination for a purrfect spa experience.",
                    image: "../static/demo/assets/coupon_cat.jpeg",
                    address: "567 Calm Street, Catville, Purrland",
                    latitude,
                    longitude,
                },
            },
        ];

        // Login
        let response = await login(user);
        const cookies = getCookiesFromResponse(response);

        for (const { storeMetadata, couponMetadata } of demoStoresCoupons) {
            // Read store image
            const storeImageBuffer = readImageAsBuffer(storeMetadata.image);
            const storeImage = new Blob([storeImageBuffer], {
                type: "image/jpeg",
            });
            const storeImageFile = new File([storeImage], "coupon_cat.jpeg", {
                type: "image/jpeg",
            });

            // Create store
            let tx = await createStore(
                {
                    name: storeMetadata.name,
                    description: storeMetadata.description,
                    address: storeMetadata.address,
                    region: regionCode,
                    latitude,
                    longitude,
                    geohash: String.fromCharCode(...geoHere),
                    logo: storeImageFile,
                },
                {
                    headers: { Cookie: cookies },
                    wallet: userWallet,
                },
            );

            // Fetch stores
            const stores = await fetchStores({ Cookie: cookies });
            const store = stores.find(
                (store) => store.account.name === storeMetadata.name,
            );
            expect(store).toBeDefined();

            // Read coupon image
            const couponImageBuffer = readImageAsBuffer(couponMetadata.image);
            const couponImage = new Blob([couponImageBuffer], {
                type: "image/jpeg",
            });
            const couponImageFile = new File([couponImage], "coupon_cat.jpeg", {
                type: "image/jpeg",
            });

            // Create coupon
            tx = await createCoupon(
                {
                    image: couponImageFile,
                    name: couponMetadata.name,
                    description: couponMetadata.description,
                    validFrom: beforeToday,
                    validTo: afterToday,
                    store: store!,
                },
                {
                    headers: { Cookie: cookies },
                    wallet: userWallet,
                },
            );

            // Mint Coupons
            let coupons = await fetchMintedCouponSupplyBalance(
                stores[0].publicKey,
                {
                    Cookie: cookies,
                },
            );

            // iterate coupons
            for (let [coupon, supply, balance] of coupons) {
                tx = await mintCoupon(
                    {
                        numTokens: 5,
                        coupon,
                    },
                    {
                        headers: { Cookie: cookies },
                        wallet: userWallet,
                    },
                );
            }
        }
    },
    { timeout: 1000 * 20 },
);
