import { assert } from "chai";
import AnchorClient from "../../app/src/lib/anchorClient";
import { cleanString } from "../../app/src/lib/utils";
import { getMint } from "@solana/spl-token";
import { web3 } from "@coral-xyz/anchor";

describe("Test coupon", () => {
    const client = new AnchorClient();

    it("Airdrop", async () => {
        // get some sol to perform tx
        const sig = await client.requestAirdrop(100e9);
    });

    it("Create user", async () => {
        const geo = "gbsuv7";
        const region = "SGP";

        await client.createUser({ geo, region });

        const [pda, _] = client.getUserPda();
        const user = await client.program.account.user.fetch(pda);

        assert.ok(user.geo == geo);
        assert.ok(user.region == region);
    });

    describe("Coupon (Create, Mint, Claim, Redeem)", () => {
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

            assert.equal(cleanString(coupon.account.geo), geo);
            assert.equal(cleanString(coupon.account.region), region);
            assert.equal(cleanString(coupon.account.uri), uri);
            assert.equal(cleanString(coupon.account.name), name);
            assert.equal(cleanString(coupon.account.symbol), symbol);
            assert.ok(
                coupon.account.updateAuthority.equals(client.wallet.publicKey)
            );
        });

        it("Mint to region market", async () => {
            const coupons = await client.getMintedCoupons();
            assert.ok(coupons.length === 1);
            const coupon = coupons[0];

            // check mint supply before
            assert.equal(
                (await getMint(client.connection, coupon.account.mint)).supply,
                BigInt(0)
            );

            const numTokens = 1;

            // mint coupon to region market
            assert.isNull(
                (
                    await client.mintToMarket(
                        coupon.account.mint,
                        coupon.account.region,
                        numTokens
                    )
                ).err
            );

            // check regionMarket created
            const [regionMarketPda, regionMarketTokenAccountPda] =
                await client.getRegionMarketPdasFromMint(coupon.account.mint);
            let regionMarket = await client.program.account.regionMarket.fetch(
                regionMarketPda
            );
            assert.equal(regionMarket.region, coupon.account.region);

            // check regionMarketTokenAccountPda balance
            const balance = await client.connection.getTokenAccountBalance(
                regionMarketTokenAccountPda
            );
            assert.equal(balance.value.amount, `${numTokens}`);

            // check mint supply after
            assert.equal(
                (await getMint(client.connection, coupon.account.mint)).supply,
                BigInt(numTokens)
            );
        });

        it("Get coupons from region", async () => {
            const coupons = await client.getCoupons(region);
            assert.ok(coupons.length > 0);
            for (const coupon of coupons) {
                assert.ok(cleanString(coupon.account.region) === region);
            }
        });

        it("Claim from market", async () => {
            // get coupon
            const coupons = await client.getMintedCoupons();
            assert.ok(coupons.length === 1);
            const coupon = coupons[0];

            // userTokenAccount not created at this point
            const userTokenAccount = await client.getUserTokenAccount(
                coupon.account.mint
            );

            // claim 1 token
            await client.claimFromMarket(coupon.account.mint, 1);

            // check balance after
            const balanceAfter = await client.connection.getTokenAccountBalance(
                userTokenAccount
            );
            assert.equal(balanceAfter.value.amount, `1`);
        });

        it("Get claimed coupons", async () => {
            const couponsBalance = await client.getClaimedCoupons();

            assert.equal(couponsBalance.length, 1);

            const [coupon, balance] = couponsBalance[0];

            assert.equal(balance, 1);
            assert.equal(cleanString(coupon.account.geo), geo);
            assert.equal(cleanString(coupon.account.region), region);
            assert.equal(cleanString(coupon.account.uri), uri);
            assert.equal(cleanString(coupon.account.name), name);
            assert.equal(cleanString(coupon.account.symbol), symbol);
        });

        it("Redeem coupon", async () => {
            // get coupon
            const coupons = await client.getMintedCoupons();
            assert.ok(coupons.length === 1);
            const coupon = coupons[0];

            const userTokenAccount = await client.getUserTokenAccount(
                coupon.account.mint
            );

            // check balance before
            const balanceBefore =
                await client.connection.getTokenAccountBalance(
                    userTokenAccount
                );
            assert.equal(balanceBefore.value.amount, `1`);

            // redeem token
            const couponPda = client.getCouponPda(coupon.account.mint)[0];
            await client.redeemCoupon({
                coupon: couponPda,
                mint: coupon.account.mint,
                wallet: client.wallet.publicKey,
                numTokens: 1,
            });

            // check balance after
            const balanceAfter = await client.connection.getTokenAccountBalance(
                userTokenAccount
            );
            assert.equal(balanceAfter.value.amount, `0`);
        });
    });
});