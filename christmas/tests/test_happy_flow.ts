import { web3 } from "@coral-xyz/anchor";
import { assert, expect } from "chai";
import { AnchorClient } from "../lib/anchor-client/anchorClient";
import * as anchor from "@coral-xyz/anchor";
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

describe("Test client", () => {
    // Configure the client to use the local cluster.
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const geo = "gbsuv7";
    const region = "SGP";

    const couponName = "coupon1";
    const couponUri = "www.example.com";
    const couponSymbol = "#COU";

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

        // Airdrop wallets for transactions
        await sellerClient.requestAirdrop(100e9);
        await buyerClient.requestAirdrop(100e9);
    });

    it("Initialize program", async () => {
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

    it("Create users", async () => {
        await sellerClient.createUser({ geo, region });
        await buyerClient.createUser({ geo, region });

        const seller = await sellerClient.getUser();
        assert.equal(cleanString(seller.geo), geo);
        assert.equal(cleanString(seller.region), region);
        const buyer = await buyerClient.getUser();
        assert.equal(cleanString(buyer.geo), geo);
        assert.equal(cleanString(buyer.region), region);
    });

    it("Create coupon", async () => {
        // create coupon
        assert.isNull(
            (
                await sellerClient.createCoupon({
                    geo,
                    region,
                    name: couponName,
                    uri: couponUri,
                    symbol: couponSymbol,
                })
            ).result.err
        );

        // check if coupon is created
        const coupons = await sellerClient.getMintedCoupons();

        assert.ok(coupons.length === 1);
        const [coupon, supply, balance] = coupons[0];

        assert.equal(cleanString(coupon.account.geo), geo);
        assert.equal(cleanString(coupon.account.region), region);
        assert.equal(cleanString(coupon.account.uri), couponUri);
        assert.equal(cleanString(coupon.account.name), couponName);
        assert.equal(cleanString(coupon.account.symbol), couponSymbol);
        assert.ok(
            coupon.account.updateAuthority.equals(
                sellerClient.anchorWallet.publicKey
            )
        );
    });

    it("Mint coupon", async () => {
        const numTokens = 10;

        // check mint supply before
        const coupons = await sellerClient.getMintedCoupons();
        assert.ok(coupons.length === 1);
        const [coupon, supply, _balance] = coupons[0]; // mint the first coupon
        assert.equal(supply, 0);

        // mint coupon to region market
        assert.isNull(
            (
                await sellerClient.mintToMarket(
                    coupon.account.mint,
                    coupon.account.region,
                    numTokens
                )
            ).result.err
        );

        // check regionMarket created
        const [regionMarketPda, regionMarketTokenAccountPda] =
            await sellerClient.getRegionMarketPdasFromMint(coupon.account.mint);
        let regionMarket =
            await sellerClient.program.account.regionMarket.fetch(
                regionMarketPda
            );
        assert.equal(regionMarket.region, coupon.account.region);

        // check regionMarketTokenAccountPda balance
        const balance = await sellerClient.connection.getTokenAccountBalance(
            regionMarketTokenAccountPda
        );
        assert.equal(balance.value.amount, `${numTokens}`);

        // check mint supply after
        assert.equal(
            (await getMint(sellerClient.connection, coupon.account.mint))
                .supply,
            BigInt(numTokens)
        );
    });

    it("Claim from market", async () => {
        // get coupon from seller
        const coupons = await sellerClient.getMintedCoupons();
        assert.ok(coupons.length === 1);
        const [coupon, supply, balance] = coupons[0];

        // userTokenAccount not created at this point
        const userTokenAccount = await buyerClient.getUserTokenAccount(
            coupon.account.mint
        );

        // claim 1 token
        await buyerClient.claimFromMarket(coupon.account.mint, 1);

        // check balance after
        const balanceAfter =
            await buyerClient.connection.getTokenAccountBalance(
                userTokenAccount
            );
        assert.equal(balanceAfter.value.amount, `1`);
    });

    it("Get claimed coupons", async () => {
        const couponsBalance = await buyerClient.getClaimedCoupons();

        assert.equal(couponsBalance.length, 1);

        const [coupon, balance] = couponsBalance[0];

        assert.equal(balance, 1);
        assert.equal(cleanString(coupon.account.geo), geo);
        assert.equal(cleanString(coupon.account.region), region);
        assert.equal(cleanString(coupon.account.uri), couponUri);
        assert.equal(cleanString(coupon.account.name), couponName);
        assert.equal(cleanString(coupon.account.symbol), couponSymbol);
    });

    it("Redeem coupon", async () => {
        // get coupon
        const coupons = await sellerClient.getMintedCoupons();
        assert.ok(coupons.length === 1);
        const [coupon, supply, balance] = coupons[0];

        const userTokenAccount = await buyerClient.getUserTokenAccount(
            coupon.account.mint
        );

        // check balance before
        const balanceBefore =
            await buyerClient.connection.getTokenAccountBalance(
                userTokenAccount
            );
        assert.equal(balanceBefore.value.amount, `1`);

        // redeem token
        const couponPda = buyerClient.getCouponPda(coupon.account.mint)[0];
        const transactionResult = await buyerClient.redeemCoupon({
            coupon: couponPda,
            mint: coupon.account.mint,
            numTokens: 1,
        });

        // check balance after
        const balanceAfter =
            await buyerClient.connection.getTokenAccountBalance(
                userTokenAccount
            );
        assert.equal(balanceAfter.value.amount, `0`);

        // test redemption QR code
        const redemptionQRCodeURL = generateQRCodeURL({
            signature: transactionResult.signature,
            wallet: buyerClient.anchorWallet.publicKey.toString(),
            mint: coupon.account.mint.toString(),
            numTokens: String(1),
        });
        assert.equal(
            redemptionQRCodeURL,
            `https://\${origin}?mint=${
                coupon.account.mint
            }&numTokens=${1}&signature=${
                transactionResult.signature
            }&wallet=${buyerClient.anchorWallet.publicKey.toString()}`
        );

        // test extract redemption parameters
        const redemptionParams = extractQueryParams(redemptionQRCodeURL);
        expect(redemptionParams).to.deep.equal({
            signature: String(transactionResult.signature),
            wallet: buyerClient.anchorWallet.publicKey.toString(),
            mint: String(coupon.account.mint),
            numTokens: String(1),
        });

        // test verify redemption
        const result = await sellerClient.verifyRedemption({
            signature: redemptionParams.signature,
            wallet: new web3.PublicKey(redemptionParams.wallet),
            mint: new web3.PublicKey(redemptionParams.mint),
            numTokens: parseInt(redemptionParams.numTokens),
        });
        assert.equal(result.isVerified, true);

        // TODO: add tests for failed verification (possible make this a separate test)
    });

    it("Get users within radius", async () => {
        // Create some users around singapore
        // prettier-ignore
        let hashesAroundSingapore = [
            "w21z3w", "w21ze8", "w21zgh", "w21zem", "w21zd5", "w21z9c", "w21zg8", "w21ze0",
            // "w21z7r", "w21z9f", "w21zf4", "w21z9b", "w21z6x", "w21zdt", "w21ze7", "w21zgs",
            // "w21zd0", "w21ze2", "w21zcc", "w21zcg", "w21zg1", "w21zfd", "w21zg4", "w21zex",
            // "w21zf7", "w21zen", "w21zd6", "w21zfn", "w21zfk", "w21zc8", "w21zgn", "w21zd2",
            // "w21zet", "w21zfq", "w21z9z", "w21ze4", "w21zgw", "w21zed", "w21z98", "w21zfg",
            // "w21zfw", "w21zg2", "w21zdh", "w21zcb", "w21ze9", "w21zf6", "w21z7n", "w21zeh",
            // "w21zdw", "w21zcy", "w21z9d", "w21zdc", "w21zf2", "w21zdu", "w21zdz", "w21zf9",
            // "w21z9y", "w21zdk", "w21zdq", "w21zgk", "w21zg5", "w21zgq", "w21z9w", "w21ze6",
            // "w21zcq", "w21zfv", "w21zf8", "w21z9g", "w21z9t", "w21zfu", "w21z7p", "w21z7w",
            // "w21zgm", "w21zc9", "w21zdj", "w21zdg", "w21zfy", "w21zdm", "w21zgt", "w21z9v",
        ]

        const userLocations = hashesAroundSingapore.map(
            (geo: string): [web3.Keypair, string] => {
                return [web3.Keypair.generate(), geo];
            }
        );

        // Airdrop users
        await requestAirdrop(
            userLocations.map(([user, _]) => user.publicKey),
            100e9
        );

        // Create users
        const pdas = await Promise.all(
            userLocations.map(([user, geo]) => {
                return new Promise<[web3.PublicKey, number]>(
                    async (resolve) => {
                        const region = "SGP";
                        const [pda, bump] = await createUser(user, region, geo);
                        resolve([pda, bump]);
                    }
                );
            })
        );

        /*
            TODO:
            1. Write geohash function in JS utils
            2. Get geohashes in radius
            3. Filter accounts for geohashes

            - given geo hash center and radius
            - given the radius, choose an appropriate precision (number of digits) to reduce the search space
            - get all geohashes in scope (up to precision)
            - calculate largest common prefixes (might have more than 1)
            - query memcmp based on largest common prefixes (bits) (get a bunch of users)
            - filter finely the results if they are in the original set
            - this is because we can only retrieve the accounts using memcmp with a bit prefix
        */

        const user_accounts = await buyerClient.program.account.user.all([
            {
                dataSize: USER_ACCOUNT_SIZE,
            },
            {
                memcmp: {
                    offset:
                        DISCRIMINATOR_SIZE + REGION_SIZE + STRING_PREFIX_SIZE,
                    bytes: bs58.encode(Buffer.from("w21zc9", "utf-8")),
                },
            },
        ]);
    });
});
