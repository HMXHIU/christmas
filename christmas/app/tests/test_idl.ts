import { assert, expect } from "chai";
import idl from "../../target/idl/christmas.json";
import * as web3 from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import AnchorClient from "../src/lib/anchorClient";

describe("Test client functions", () => {
    const client = new AnchorClient();

    it("Airdrop", async () => {
        // get some sol to perform tx
        const sig = await client.requestAirdrop(100e9);
        console.log(`Airdrop: ${sig}`);
    });

    it("Get user PDA", async () => {
        const [pda, bump] = client.getUserPDA();
        assert(pda);
        console.log(`pda: ${pda}, bump: ${bump}`);
    });

    it("Create user", async () => {
        const email = "christmas@gmail.com";
        const geo = "gbsuv7";
        const region = "SGP";

        await client.createUser({ email, geo, region });

        const [pda, _] = client.getUserPDA();
        const user = await client.program.account.user.fetch(pda);

        assert.ok(user.geo == geo);
        assert.ok(user.region == region);
    });

    it("Create coupon", async () => {
        const geo = "gbsuv7";
        const region = "SGP";
        const uri = "http://someuri.com";
        const name = "Drinks on us";
        const symbol = "DNKS #1";

        // create coupon
        await client.createCoupon({ geo, region, name, uri, symbol });

        // check if coupon is created
        const coupons = await client.getMintedCoupons();
        assert.ok(coupons.length === 1);
        assert.equal(coupons[0].geo, geo);
        assert.equal(coupons[0].region, region);
        assert.equal(coupons[0].uri, uri);
        assert.equal(coupons[0].name, name);
        assert.equal(coupons[0].symbol, symbol);
        assert.ok(coupons[0].updateAuthority.equals(client.wallet.publicKey));
    });
});
