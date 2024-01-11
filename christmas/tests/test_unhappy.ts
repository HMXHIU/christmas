import { web3 } from "@coral-xyz/anchor";
import ngeohash from "ngeohash";
import { AnchorClient } from "../lib/anchor-client/anchorClient";
import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import { cleanString } from "../lib/anchor-client/utils";
import { getMint } from "@solana/spl-token";
import { generateQRCodeURL, extractQueryParams } from "../app/src/lib/utils";
import { requestAirdrop, createUser } from "./utils";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import {
    USER_ACCOUNT_SIZE,
    DISCRIMINATOR_SIZE,
    REGION_SIZE,
    STRING_PREFIX_SIZE,
} from "../lib/anchor-client/defs";

import chai from "chai";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
import { assert, expect } from "chai";
import { Location } from "../lib/user-device-client/types";

describe("Test Unhappy", () => {
    // set provider
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    // users
    const sellerKeypair = web3.Keypair.generate();
    const sellerAnchorWallet = new anchor.Wallet(sellerKeypair);
    const buyerKeypair = web3.Keypair.generate();
    const buyerAnchorWallet = new anchor.Wallet(buyerKeypair);
    let sellerClient: AnchorClient;
    let buyerClient: AnchorClient;

    // store
    let store: web3.PublicKey;

    // locations
    const geoHere = "w21z3w";
    const geoNorth = "w21z98";
    const geoSouth = "w21z1x";
    const geoEast = "w21z6m";
    const geoWest = "w21z2u";

    const region = "SGP";
    const { latitude, longitude } = ngeohash.decode(geoHere);
    const location: Location = {
        geohash: geoHere,
        country: {
            code: region,
            name: "Singapore",
        },
        geolocationCoordinates: {
            latitude,
            longitude,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
            accuracy: null,
        },
    };

    // dates
    const today = new Date();
    const afterToday = new Date(today);
    afterToday.setMonth(afterToday.getMonth() + 3);
    const longAfterToday = new Date(today);
    longAfterToday.setMonth(longAfterToday.getMonth() + 6);
    const beforeToday = new Date(today);
    beforeToday.setMonth(beforeToday.getMonth() - 3);
    const longBeforeToday = new Date(today);
    longBeforeToday.setMonth(longBeforeToday.getMonth() - 6);

    it("Initialize AnchorClient", async () => {
        sellerClient = new AnchorClient({
            anchorWallet: sellerAnchorWallet,
            location,
        });
        buyerClient = new AnchorClient({
            anchorWallet: buyerAnchorWallet,
            location,
        });
        expect(sellerClient.cluster).to.equal("http://127.0.0.1:8899");
        assert.ok(
            sellerClient.programId.equals(anchor.workspace.Christmas.programId)
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

    it("Create Users", async () => {
        await sellerClient.createUser({ geo: geoHere, region });
        await buyerClient.createUser({ geo: geoHere, region });

        const seller = await sellerClient.getUser();
        assert.equal(cleanString(seller.geo), geoHere);
        assert.equal(cleanString(seller.region), region);
        const buyer = await buyerClient.getUser();
        assert.equal(cleanString(buyer.geo), geoHere);
        assert.equal(cleanString(buyer.region), region);
    });

    it("Create store with invalid params", async () => {
        /**
         * Test creating a store with a very long name and uri
         */

        const storeName =
            "A very very very very very very very very very very very very very very very very long store name";
        const storeUri =
            "https://example.example.example.example.example.example.example.example.example.example.com";

        expect(
            sellerClient.createStore({
                name: storeName,
                uri: storeUri,
                region,
                geo: geoHere,
            })
        ).to.be.rejectedWith("Store name exceeds maximum length of 40");
    });

    it("Create store", async () => {
        const storeId = await sellerClient.getAvailableStoreId();
        store = await sellerClient.getStorePda(storeId)[0];
        const storeName = "ok store";
        const storeUri = "https://example.store.com";
        assert.isNull(
            (
                await sellerClient.createStore({
                    name: storeName,
                    uri: storeUri,
                    region,
                    geo: geoHere,
                })
            ).result.err
        );
    });

    it("Coupon validity", async () => {
        // create coupons (out of validity period)
        assert.isNull(
            (
                await sellerClient.createCoupon({
                    geo: geoHere,
                    region,
                    store,
                    name: "before",
                    uri: "https://coupon.com",
                    validFrom: longBeforeToday,
                    validTo: beforeToday,
                })
            ).result.err
        );
        assert.isNull(
            (
                await sellerClient.createCoupon({
                    geo: geoHere,
                    region,
                    store,
                    name: "after",
                    uri: "https://coupon.com",
                    validFrom: afterToday,
                    validTo: longAfterToday,
                })
            ).result.err
        );

        // mint out of valid period coupons
        const mintedCoupons = await sellerClient.getMintedCoupons(store);

        for (const [coupon, supply, balance] of mintedCoupons) {
            if (
                ["after", "before"].includes(cleanString(coupon.account.name))
            ) {
                assert.isNull(
                    (
                        await sellerClient.mintToMarket(
                            coupon.account.mint,
                            coupon.account.region,
                            1
                        )
                    ).result.err
                );
            }
        }

        // check does not return out of validity coupons
        const marketCoupons = await sellerClient.getCoupons(region);
        const couponNames = marketCoupons.map(([coupon, _]) => {
            return cleanString(coupon.account.name);
        });
        assert.notOk(couponNames.includes("after"));
        assert.notOk(couponNames.includes("before"));
    });

    it("Coupon in range", async () => {
        // create coupons (4 out of range, 1 in range)
        for (const geo of [geoHere, geoNorth, geoSouth, geoEast, geoWest]) {
            assert.isNull(
                (
                    await sellerClient.createCoupon({
                        geo,
                        region,
                        store,
                        name: geo,
                        uri: `https://geohash.softeng.co/${geo}`,
                        validFrom: beforeToday,
                        validTo: afterToday,
                    })
                ).result.err
            );
        }

        // mint coupons
        const mintedCoupons = await sellerClient.getMintedCoupons(store);
        for (const [coupon, supply, balance] of mintedCoupons) {
            if (
                [geoHere, geoNorth, geoSouth, geoEast, geoWest].includes(
                    cleanString(coupon.account.name)
                )
            ) {
                assert.isNull(
                    (
                        await sellerClient.mintToMarket(
                            coupon.account.mint,
                            coupon.account.region,
                            1
                        )
                    ).result.err
                );
            }
        }

        // check does not return out of range coupons
        const couponNames = (await sellerClient.getCoupons(region)).map(
            ([coupon, _]) => cleanString(coupon.account.name)
        );
        for (const geo of [geoNorth, geoSouth, geoEast, geoWest]) {
            assert.notOk(couponNames.includes(geo));
        }

        // check returns coupon in range
        assert.ok(couponNames.includes(geoHere));
    });
});
