import { web3 } from "@coral-xyz/anchor";
import * as anchor from "@coral-xyz/anchor";
import { cleanString, stringToUint8Array } from "../app/src/lib/utils";

import chai from "chai";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
import { assert, expect } from "chai";
import { PROGRAM_ID } from "../app/src/lib/anchorClient/defs";
import { getRandomAnchorClient } from "./utils";

describe("Test Unhappy", () => {
    // users
    const [sellerKeypair, sellerClient] = getRandomAnchorClient();
    const [buyerKeypair, buyerClient] = getRandomAnchorClient();

    // store
    let store: web3.PublicKey;

    // locations
    const geoHere = Array.from(stringToUint8Array("w21z3w"));
    const geoNorth = Array.from(stringToUint8Array("w21z98"));
    const geoSouth = Array.from(stringToUint8Array("w21z1x"));
    const geoEast = Array.from(stringToUint8Array("w21z6m"));
    const geoWest = Array.from(stringToUint8Array("w21z2u"));
    const region = Array.from(stringToUint8Array("SGP"));

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

    it("Create Users", async () => {
        await sellerClient.createUser({ region, uri: "" });
        await buyerClient.createUser({ region, uri: "" });

        const seller = await sellerClient.getUser();
        expect(seller.region).to.eql(region);
        const buyer = await buyerClient.getUser();
        expect(buyer.region).to.eql(region);
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
                geohash: geoHere,
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
                    geohash: geoHere,
                })
            ).result.err
        );
    });

    it("Coupon validity", async () => {
        // create coupons (out of validity period)
        assert.isNull(
            (
                await sellerClient.createCoupon({
                    geohash: geoHere,
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
                    geohash: geoHere,
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
        const mintedCoupons = await sellerClient.getMintedCoupons({ store });

        for (const [coupon, supply, balance] of mintedCoupons) {
            if (
                ["after", "before"].includes(cleanString(coupon.account.name))
            ) {
                assert.isNull(
                    (
                        await sellerClient.mintToMarket({
                            mint: coupon.account.mint,
                            region: coupon.account.region,
                            coupon: coupon.publicKey,
                            numTokens: 1,
                        })
                    ).result.err
                );
            }
        }

        // check does not return out of validity coupons
        const marketCoupons = await sellerClient.getCoupons({
            region,
            geohash: geoHere,
        });
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
                        geohash: geo,
                        region,
                        store,
                        name: String.fromCharCode(...geo),
                        uri: `https://geohash.softeng.co/${geo}`,
                        validFrom: beforeToday,
                        validTo: afterToday,
                    })
                ).result.err
            );
        }

        // mint coupons
        const mintedCoupons = await sellerClient.getMintedCoupons({ store });

        for (const [coupon, supply, balance] of mintedCoupons) {
            if (
                [
                    String.fromCharCode(...geoHere),
                    String.fromCharCode(...geoNorth),
                    String.fromCharCode(...geoSouth),
                    String.fromCharCode(...geoEast),
                    String.fromCharCode(...geoWest),
                ].includes(cleanString(coupon.account.name))
            ) {
                assert.isNull(
                    (
                        await sellerClient.mintToMarket({
                            mint: coupon.account.mint,
                            region: coupon.account.region,
                            coupon: coupon.publicKey,
                            numTokens: 1,
                        })
                    ).result.err
                );
            }
        }

        // check does not return out of range coupons
        const couponNames = (
            await sellerClient.getCoupons({ region, geohash: geoHere })
        ).map(([coupon, _]) => cleanString(coupon.account.name));
        for (const geo of [
            String.fromCharCode(...geoNorth),
            String.fromCharCode(...geoSouth),
            String.fromCharCode(...geoEast),
            String.fromCharCode(...geoWest),
        ]) {
            assert.notOk(couponNames.includes(geo));
        }

        // check returns coupon in range
        assert.ok(couponNames.includes(String.fromCharCode(...geoHere)));
    });
});
