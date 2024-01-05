import { web3 } from "@coral-xyz/anchor";
import { assert, expect } from "chai";
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

describe("Test Coupon", () => {
    // set provider
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    // const geo = "gbsuv7";
    // const region = "SGP";

    // let storeId: BN;
    // const storeName = "My store";
    // const storeUri = "https://example.com";

    // const couponName = "coupon1";
    // const couponUri = "www.example.com";
    // const couponSymbol = "#COU";

    // // validity period
    // const validFrom = new Date(Date.UTC(2024, 0, 1));
    // const validTo = new Date(Date.UTC(2025, 11, 31));

    const sellerKeypair = web3.Keypair.generate();
    const sellerAnchorWallet = new anchor.Wallet(sellerKeypair);

    const buyerKeypair = web3.Keypair.generate();
    const buyerAnchorWallet = new anchor.Wallet(buyerKeypair);

    let sellerClient: AnchorClient;
    let buyerClient: AnchorClient;

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
        const geo = "gbsuv7";
        const region = "SGP";

        await sellerClient.createUser({ geo, region });
        await buyerClient.createUser({ geo, region });

        const seller = await sellerClient.getUser();
        assert.equal(cleanString(seller.geo), geo);
        assert.equal(cleanString(seller.region), region);
        const buyer = await buyerClient.getUser();
        assert.equal(cleanString(buyer.geo), geo);
        assert.equal(cleanString(buyer.region), region);
    });

    it("Create Store", async () => {
        /**
         * Test creating a store with a very long name and uri
         */
        const geo = "gbsuv7";
        const region = "SGP";
        const storeId = await sellerClient.getAvailableStoreId();
        const storeName =
            "A very very very very very very very very very very very very very very very very long store name";
        const storeUri =
            "https://example.example.example.example.example.example.example.example.example.example.com";

        await sellerClient.createStore({
            name: storeName,
            uri: storeUri,
            region,
            geo,
        });

        // test next store_counter
        assert.ok(storeId.addn(1).eq(await sellerClient.getAvailableStoreId()));

        let store = await sellerClient.getStore(storeId);
        assert.equal(cleanString(store.name), storeName);
        assert.equal(cleanString(store.region), region);
        assert.equal(cleanString(store.uri), storeUri);
        assert.equal(cleanString(store.geo), geo);
        assert.ok(store.id.eq(storeId));
        assert.ok(store.owner.equals(sellerClient.anchorWallet.publicKey));
    });

    // it("Create Coupon", async () => {
    //     // get store
    //     let [store, _] = await sellerClient.getStorePda(storeId);

    //     // create coupon
    //     assert.isNull(
    //         (
    //             await sellerClient.createCoupon({
    //                 geo,
    //                 region,
    //                 store,
    //                 name: couponName,
    //                 uri: couponUri,
    //                 symbol: couponSymbol,
    //                 validFrom,
    //                 validTo,
    //             })
    //         ).result.err
    //     );

    //     // check if coupon is created
    //     const coupons = await sellerClient.getMintedCoupons();

    //     assert.ok(coupons.length === 1);
    //     const [coupon, supply, balance] = coupons[0];

    //     assert.equal(cleanString(coupon.account.geo), geo);
    //     assert.equal(cleanString(coupon.account.region), region);
    //     assert.equal(cleanString(coupon.account.uri), couponUri);
    //     assert.equal(cleanString(coupon.account.name), couponName);
    //     assert.equal(cleanString(coupon.account.symbol), couponSymbol);
    //     assert.ok(
    //         coupon.account.updateAuthority.equals(
    //             sellerClient.anchorWallet.publicKey
    //         )
    //     );
    //     assert.ok(coupon.account.store.equals(store));
    // });
});
