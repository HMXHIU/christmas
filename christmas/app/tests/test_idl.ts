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
});
