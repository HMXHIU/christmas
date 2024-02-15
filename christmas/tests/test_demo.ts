import { web3 } from "@coral-xyz/anchor";
import ngeohash from "ngeohash";
import { AnchorClient } from "../app/src/lib/anchorClient";
import * as anchor from "@coral-xyz/anchor";
import { stringToUint8Array } from "../app/src/lib/utils";

import chai from "chai";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
import { assert, expect } from "chai";
import { login, requestAirdrop } from "./utils";
import { getCookiesFromResponse } from "../app/tests/utils";
import { CouponMetadata, StoreMetadata } from "../app/src/lib/community/types";
import { PROGRAM_ID } from "../app/src/lib/anchorClient/defs";
import { createStore } from "../app/src/lib/community";
import { PublicKey } from "@solana/web3.js";

describe("Generate Demo Content", () => {
    // users
    const sellerKeypair = web3.Keypair.generate();
    const buyerKeypair = web3.Keypair.generate();
    let sellerClient: AnchorClient;
    let buyerClient: AnchorClient;

    // locations (https://geohash.softeng.co/w21z3w)
    const geoHere = Array.from(stringToUint8Array("w21z98")); // faber heights
    // const geoHere = Array.from(stringToUint8Array("w21z71")); // metacamp
    // const geoHere = Array.from(stringToUint8Array("w21z4w")); // harbour front
    // const geoHere = Array.from(stringToUint8Array("w21z3p")); // clementi mall
    const region = Array.from(stringToUint8Array("SGP"));
    const { latitude, longitude } = ngeohash.decode(
        String.fromCharCode(...geoHere)
    );

    // dates
    const today = new Date();
    const afterToday = new Date(today);
    afterToday.setMonth(afterToday.getMonth() + 3);
    const beforeToday = new Date(today);
    beforeToday.setMonth(beforeToday.getMonth() - 3);

    // stores and coupons
    const demoStoresCoupons: {
        couponMetadata: CouponMetadata;
        storeMetadata: StoreMetadata;
    }[] = [
        {
            couponMetadata: {
                name: "SereneSpa",
                description:
                    "Unwind with our exclusive spa coupon! Indulge in blissful relaxation and pamper yourself. Your escape to tranquility awaits.",
                image: "http://localhost:5173/demo/assets/coupon_spa.jpeg",
            },
            storeMetadata: {
                name: "SereneSpa Emporium",
                description:
                    "Discover a haven of serenity at SereneSpa Emporium. Your one-stop destination for luxurious spa essentials and wellness treasures.",
                image: "http://localhost:5173/demo/assets/coupon_spa.jpeg",
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
                image: "http://localhost:5173/demo/assets/coupon_lotion.jpeg",
            },
            storeMetadata: {
                name: "Luxurious Lotions Boutique",
                description:
                    "Indulge in the finest lotions at Luxurious Lotions Boutique. Elevate your skincare ritual with our curated collection of luxurious products.",
                image: "http://localhost:5173/demo/assets/coupon_lotion.jpeg",
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
                image: "http://localhost:5173/demo/assets/coupon_free_gift.jpeg",
            },
            storeMetadata: {
                name: "Glowing Gifts Emporium",
                description:
                    "Find joy in every gift at Glowing Gifts Emporium. Discover a world of surprises that illuminate your senses.",
                image: "http://localhost:5173/demo/assets/coupon_free_gift.jpeg",
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
                image: "http://localhost:5173/demo/assets/coupon_cyber.jpeg",
            },
            storeMetadata: {
                name: "ZenTech Wellness Hub",
                description:
                    "Experience wellness in the digital age at ZenTech Wellness Hub. Your journey to CyberZen begins here.",
                image: "http://localhost:5173/demo/assets/coupon_cyber.jpeg",
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
                image: "http://localhost:5173/demo/assets/coupon_wine.jpeg",
            },
            storeMetadata: {
                name: "VinoVibes Cellars",
                description:
                    "Raise your glass to joy at VinoVibes Cellars. Explore a world of exquisite wines that enhance your spa experience.",
                image: "http://localhost:5173/demo/assets/coupon_wine.jpeg",
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
                image: "http://localhost:5173/demo/assets/coupon_cat.jpeg",
            },
            storeMetadata: {
                name: "Purrfect Relaxation Haven",
                description:
                    "Find tranquility in the company of feline friends at Purrfect Relaxation Haven. Your ultimate destination for a purrfect spa experience.",
                image: "http://localhost:5173/demo/assets/coupon_cat.jpeg",
                address: "567 Calm Street, Catville, Purrland",
                latitude,
                longitude,
            },
        },
    ];

    it("Initialize AnchorClient", async () => {
        sellerClient = new AnchorClient({
            keypair: sellerKeypair,
        });
        buyerClient = new AnchorClient({
            keypair: buyerKeypair,
        });
        expect(sellerClient.cluster).to.equal("http://127.0.0.1:8899");
        assert.ok(
            sellerClient.programId.equals(new web3.PublicKey(PROGRAM_ID))
        );
        assert.ok(
            sellerClient.provider.publicKey?.equals(sellerKeypair.publicKey)
        );

        // airdrop wallets for transactions
        await sellerClient.requestAirdrop(100e9);
        await buyerClient.requestAirdrop(100e9);
    });

    it("Initialize Program", async () => {
        await sellerClient.initializeProgram();

        const [programStatePda, _] = web3.PublicKey.findProgramAddressSync(
            [anchor.utils.bytes.utf8.encode("state")],
            sellerClient.programId
        );

        const programState =
            await sellerClient.program.account.programState.fetch(
                programStatePda
            );

        // check initialized
        assert.ok(programState.isInitialized);
    });

    it("Airdrop", async () => {
        requestAirdrop(
            [new PublicKey(process.env.PUBLIC_FEE_PAYER_PUBKEY)],
            100e9
        );
    });

    it("Create Users", async () => {
        await sellerClient.createUser({ region, uri: "" });
        await buyerClient.createUser({ region, uri: "" });

        const seller = await sellerClient.getUser();
        expect(seller.region).to.be.eql(region);
        const buyer = await buyerClient.getUser();
        expect(buyer.region).to.be.eql(region);
    });

    it("Create Demo Content", async () => {
        // Login
        let response = await login(sellerKeypair);
        const cookies = getCookiesFromResponse(response);

        for (const { storeMetadata, couponMetadata } of demoStoresCoupons) {
            // // Create store metadata
            // response = await fetch(
            //     `${process.env.PUBLIC_HOST}/api/storage/store/public`,
            //     {
            //         method: "POST",
            //         headers: {
            //             "Content-Type": "application/json",
            //             Cookie: cookies,
            //         },
            //         body: JSON.stringify({
            //             name: storeMetadata.name,
            //             description: storeMetadata.description,
            //             image: storeMetadata.image,
            //             address: storeMetadata.address,
            //             latitude: storeMetadata.latitude,
            //             longitude: storeMetadata.longitude,
            //         }),
            //     }
            // );

            // const createStoreMetadataResult = await response.json();
            // expect(createStoreMetadataResult.status).to.equal("success");

            // // Create store
            // const storeId = await sellerClient.getAvailableStoreId();
            // const store = await sellerClient.getStorePda(storeId)[0];
            // assert.isNull(
            //     (
            //         await sellerClient.createStore({
            //             name: storeMetadata.name,
            //             uri: createStoreMetadataResult.url,
            //             region,
            //             geohash: geoHere,
            //         })
            //     ).result.err
            // );

            // fetch image from url and create a File
            const response = await fetch(storeMetadata.image);
            const image = await response.blob();

            const imageFile = new File([image], "image.jpeg");

            const tx = await createStore(
                {
                    name: storeMetadata.name,
                    description: storeMetadata.description,
                    address: storeMetadata.address,
                    latitude: storeMetadata.latitude,
                    longitude: storeMetadata.longitude,
                    logo: imageFile,
                    region: String.fromCharCode(...region),
                    geohash: String.fromCharCode(...geoHere),
                },
                { Cookie: cookies }
            );

            console.log(tx);

            // // Create coupon metadata
            // response = await fetch(
            //     `${process.env.PUBLIC_HOST}/api/storage/coupon/public`,
            //     {
            //         method: "POST",
            //         headers: {
            //             "Content-Type": "application/json",
            //             Cookie: cookies,
            //         },
            //         body: JSON.stringify({
            //             name: couponMetadata.name,
            //             description: couponMetadata.description,
            //             image: couponMetadata.image,
            //         }),
            //     }
            // );

            // const createCouponMetadataResult = await response.json();
            // expect(createCouponMetadataResult.status).to.equal("success");

            // // create coupon
            // assert.isNull(
            //     (
            //         await sellerClient.createCoupon({
            //             geohash: geoHere,
            //             region,
            //             store,
            //             name: couponMetadata.name,
            //             uri: createCouponMetadataResult.url,
            //             validFrom: beforeToday,
            //             validTo: afterToday,
            //         })
            //     ).result.err
            // );

            // // mint coupons
            // const mintedCoupons = await sellerClient.getMintedCoupons(store);

            // for (const [coupon, supply, balance] of mintedCoupons) {
            //     assert.isNull(
            //         (
            //             await sellerClient.mintToMarket({
            //                 mint: coupon.account.mint,
            //                 region: coupon.account.region,
            //                 coupon: coupon.publicKey,
            //                 numTokens: 1,
            //             })
            //         ).result.err
            //     );
            // }
        }
    });
});
