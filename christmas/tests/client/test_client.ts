// import { web3 } from "@coral-xyz/anchor";
// import { assert, expect } from "chai";
// import { AnchorClient } from "../../lib/anchor-client/anchorClient";
// import idl from "../../target/idl/christmas.json";
// import * as anchor from "@coral-xyz/anchor";

// describe("Test client", () => {
//     it("Initialize default", async () => {
//         const client = new AnchorClient();
//         expect(client.cluster).to.equal("http://127.0.0.1:8899");
//         const programId = new web3.PublicKey(idl.metadata.address);
//         assert.ok(client.programId.equals(programId));
//     });

//     it("Initialize with keypair", async () => {
//         const keypair = web3.Keypair.generate();
//         const client = new AnchorClient({ wallet: new anchor.Wallet(keypair) });
//         expect(client.cluster).to.equal("http://127.0.0.1:8899");
//         const programId = new web3.PublicKey(idl.metadata.address);
//         assert.ok(client.programId.equals(programId));
//         assert.ok(client.provider.publicKey?.equals(keypair.publicKey));
//     });
// });
