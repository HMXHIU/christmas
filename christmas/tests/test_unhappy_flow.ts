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

        expect(
            sellerClient.createStore({
                name: storeName,
                uri: storeUri,
                region,
                geo,
            })
        ).to.be.rejectedWith("Store name exceeds maximum length of 40");
    });
});
