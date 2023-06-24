import { assert, expect } from "chai";
import idl from "../../target/idl/christmas.json";
import * as web3 from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import AnchorClient from "../src/lib/anchorClient";
import { getMint, TOKEN_PROGRAM_ID } from "@solana/spl-token";

describe("Test client functions", () => {
    const client = new AnchorClient();

    it("Airdrop", async () => {
        // get some sol to perform tx
        const sig = await client.requestAirdrop(100e9);
        console.log(`Airdrop: ${sig}`);
    });

    it("Get user PDA", async () => {
        const [pda, bump] = client.getUserPda();
        assert(pda);
        console.log(`pda: ${pda}, bump: ${bump}`);
    });

    it("Create user", async () => {
        const email = "christmas@gmail.com";
        const geo = "gbsuv7";
        const region = "SGP";

        await client.createUser({ email, geo, region });

        const [pda, _] = client.getUserPda();
        const user = await client.program.account.user.fetch(pda);

        assert.ok(user.geo == geo);
        assert.ok(user.region == region);
    });

    describe("Coupon", () => {
        const geo = "gbsuv7";
        const region = "SGP";
        const uri = "http://someuri.com";
        const name = "Drinks on us";
        const symbol = "DNKS #1";

        it("Create coupon", async () => {
            // create coupon
            assert.isNull(
                (await client.createCoupon({ geo, region, name, uri, symbol }))
                    .err
            );

            // check if coupon is created
            const coupons = await client.getMintedCoupons();
            assert.ok(coupons.length === 1);
            const coupon = coupons[0];

            assert.equal(coupon.geo, geo);
            assert.equal(coupon.region, region);
            assert.equal(coupon.uri, uri);
            assert.equal(coupon.name, name);
            assert.equal(coupon.symbol, symbol);
            assert.ok(coupon.updateAuthority.equals(client.wallet.publicKey));
        });

        it("Mint to region market", async () => {
            const coupons = await client.getMintedCoupons();
            assert.ok(coupons.length === 1);
            const coupon = coupons[0];

            // check mint supply before
            assert.equal(
                (await getMint(client.connection, coupon.mint)).supply,
                BigInt(0)
            );

            const numTokens = 1;

            // mint coupon to region market
            assert.isNull(
                (
                    await client.mintToMarket(
                        coupon.mint,
                        coupon.region,
                        numTokens
                    )
                ).err
            );

            // Check regionMarket created
            const [regionMarketPda, regionMarketTokenAccountPda] =
                await client.getRegionMarketPdasFromMint(coupon.mint);
            let regionMarket = await client.program.account.regionMarket.fetch(
                regionMarketPda
            );
            assert.equal(regionMarket.region, coupon.region);

            // Check regionMarketTokenAccountPda balance
            const balance = await client.connection.getTokenAccountBalance(
                regionMarketTokenAccountPda
            );
            assert.equal(balance.value.amount, `${numTokens}`);

            // check mint supply after
            assert.equal(
                (await getMint(client.connection, coupon.mint)).supply,
                BigInt(numTokens)
            );
        });
    });
});
