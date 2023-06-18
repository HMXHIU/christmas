import { assert, expect } from "chai";
import idl from "../../target/idl/christmas.json";
import * as web3 from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import AnchorClient from "../src/lib/anchorClient";

describe("Test client", () => {
    it("Initialize default", async () => {
        const client = new AnchorClient();
        expect(client.cluster).to.equal("http://localhost:8899");
        const programId = new web3.PublicKey(idl.metadata.address);
        assert.ok(client.programId.equals(programId));
    });

    it("Initialize with keypair", async () => {
        const keypair = web3.Keypair.generate();
        const client = new AnchorClient({ keypair: keypair });
        expect(client.cluster).to.equal("http://localhost:8899");
        const programId = new web3.PublicKey(idl.metadata.address);
        assert.ok(client.programId.equals(programId));
        assert.ok(client.provider.publicKey.equals(keypair.publicKey));
    });
});

describe("Test client functions", () => {
    const client = new AnchorClient();

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
