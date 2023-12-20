import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Christmas } from "../target/types/christmas";
import { web3 } from "@coral-xyz/anchor";
import { requestAirdrop } from "./utils";
import { assert } from "chai";

describe("Test Initialize", () => {
    // Configure the client to use the local cluster.
    anchor.setProvider(anchor.AnchorProvider.env());
    const provider = anchor.getProvider();
    const program = anchor.workspace.Christmas as Program<Christmas>;
    const keypair = anchor.web3.Keypair.generate();

    it("Airdrop some funds", async () => {
        await requestAirdrop([keypair.publicKey], 10e9);
    });

    it("Initialize program", async () => {
        const [programStatePda, _] = web3.PublicKey.findProgramAddressSync(
            [anchor.utils.bytes.utf8.encode("state")],
            program.programId
        );

        // initialize
        await program.methods
            .initialize()
            .accounts({
                programState: programStatePda,
                signer: keypair.publicKey,
                systemProgram: web3.SystemProgram.programId,
            })
            .signers([keypair])
            .rpc();

        const programState = await program.account.programState.fetch(
            programStatePda
        );

        // check initialized
        assert.ok(programState.isInitialized);
    });
});
