import { assert, expect } from "chai";
import idl from "../../target/idl/christmas.json";
import * as web3 from "@solana/web3.js";
import AnchorClient from "../src/lib/anchorClient";

describe("Test client", () => {
    it("Initialize default", async () => {
        const client = new AnchorClient();
        expect(client.cluster).to.equal("http://127.0.0.1:8899");
        const programId = new web3.PublicKey(idl.metadata.address);
        assert.ok(client.programId.equals(programId));
    });

    it("Initialize with keypair", async () => {
        const keypair = web3.Keypair.generate();
        const client = new AnchorClient({ keypair: keypair });
        expect(client.cluster).to.equal("http://127.0.0.1:8899");
        const programId = new web3.PublicKey(idl.metadata.address);
        assert.ok(client.programId.equals(programId));
        assert.ok(client.provider.publicKey.equals(keypair.publicKey));
    });
});
