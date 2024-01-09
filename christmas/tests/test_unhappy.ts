import { web3 } from "@coral-xyz/anchor";

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
} from "../lib/anchor-client/def";

import chai from "chai";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
import { assert, expect } from "chai";

describe("Test Coupon", () => {
    // set provider
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const sellerKeypair = web3.Keypair.generate();
    const sellerAnchorWallet = new anchor.Wallet(sellerKeypair);

    const buyerKeypair = web3.Keypair.generate();
    const buyerAnchorWallet = new anchor.Wallet(buyerKeypair);

    let sellerClient: AnchorClient;
    let buyerClient: AnchorClient;

    const geo = "gbsuv7";
    const region = "SGP";

    it("Initialize AnchorClient", async () => {
        sellerClient = new AnchorClient({ anchorWallet: sellerAnchorWallet });
        buyerClient = new AnchorClient({ anchorWallet: buyerAnchorWallet });
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
        await sellerClient.createUser({ geo, region });
        await buyerClient.createUser({ geo, region });

        const seller = await sellerClient.getUser();
        assert.equal(cleanString(seller.geo), geo);
        assert.equal(cleanString(seller.region), region);
        const buyer = await buyerClient.getUser();
        assert.equal(cleanString(buyer.geo), geo);
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
                geo,
            })
        ).to.be.rejectedWith("Store name exceeds maximum length of 40");
    });

    it("Coupon validity", async () => {
        // create store
        const storeId = await sellerClient.getAvailableStoreId();
        let [store, _] = await sellerClient.getStorePda(storeId);
        const storeName = "ok store";
        const storeUri = "https://example.store.com";
        assert.isNull(
            (
                await sellerClient.createStore({
                    name: storeName,
                    uri: storeUri,
                    region,
                    geo,
                })
            ).result.err
        );

        const today = new Date();
        const afterToday = new Date(today);
        afterToday.setMonth(afterToday.getMonth() + 3);
        const longAfterToday = new Date(today);
        longAfterToday.setMonth(longAfterToday.getMonth() + 6);
        const beforeToday = new Date(today);
        beforeToday.setMonth(beforeToday.getMonth() - 3);
        const longBeforeToday = new Date(today);
        longBeforeToday.setMonth(longBeforeToday.getMonth() - 6);

        // create coupons (out of validity period)
        assert.isNull(
            (
                await sellerClient.createCoupon({
                    geo,
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
                    geo,
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
});
