import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Christmas } from "../target/types/christmas";
import { web3 } from "@coral-xyz/anchor";
import { assert, expect } from "chai";
import { stringToUint8Array } from "./utils";
import { sha256 } from "js-sha256";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

describe("christmas", () => {
    // Configure the client to use the local cluster.
    anchor.setProvider(anchor.AnchorProvider.env());

    const provider = anchor.getProvider();
    const program = anchor.workspace.Christmas as Program<Christmas>;
    const user = anchor.web3.Keypair.generate();

    console.log(`program: ${web3.SystemProgram.programId}`);
    console.log(`user: ${user.publicKey}`);

    it("Airdrop to user", async () => {
        const sig = await provider.connection.requestAirdrop(
            user.publicKey,
            100e9
        );
        const blockHash = await provider.connection.getLatestBlockhash();
        await provider.connection.confirmTransaction({
            blockhash: blockHash.blockhash,
            lastValidBlockHeight: blockHash.lastValidBlockHeight,
            signature: sig,
        });
    });

    it("Create User", async () => {
        let email = "user@gmail.com";
        let geo = "gbsuv7";
        let region = "SGP";

        // Calculate the PDA of the user
        const [pda, _] = web3.PublicKey.findProgramAddressSync(
            [
                Buffer.from(anchor.utils.bytes.utf8.encode("user")),
                user.publicKey.toBuffer(),
            ],
            program.programId
        );

        console.log(`user pda: ${pda}`);

        // Create user
        const tx = await program.methods
            .createUser(email, region, geo)
            .accounts({
                user: pda,
                signer: user.publicKey,
                systemProgram: web3.SystemProgram.programId,
            })
            .signers([user])
            .rpc();

        // Check account is created correctly
        let _user = await program.account.user.fetch(pda);
        assert.ok(_user.geo == geo);
        assert.ok(_user.region == region);
        let twoFactor = sha256.digest([
            ...user.publicKey.toBytes(),
            ...stringToUint8Array(email),
        ]);
        expect(twoFactor).to.deep.equal(_user.twoFactor);
    });

    it("Create Coupon Mint", async () => {
        let geo = "gbsuv7";
        let region = "SGP";
        let name = "Candy";
        let symbol = "CNDY #1";
        let uri = "https://path/to/json";

        // Generate Mint keys
        const mint = anchor.web3.Keypair.generate();

        // Calculate Metadata PDA
        const [couponMetadataPda, _] = web3.PublicKey.findProgramAddressSync(
            [
                Buffer.from(anchor.utils.bytes.utf8.encode("metadata")),
                mint.publicKey.toBuffer(),
            ],
            program.programId
        );

        const tx = await program.methods
            .createCouponMint(name, symbol, region, geo, uri)
            .accounts({
                mint: mint.publicKey,
                metadata: couponMetadataPda,
                signer: user.publicKey,
                systemProgram: web3.SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([user, mint])
            .rpc();

        // Check account is created correctly
        let _metadata = await program.account.couponMetadata.fetch(
            couponMetadataPda
        );
        assert.ok(_metadata.updateAuthority.equals(user.publicKey));
        assert.ok(_metadata.geo == geo);
        assert.ok(_metadata.region == region);
        assert.ok(_metadata.name == name);
        assert.ok(_metadata.symbol == symbol);
        assert.ok(_metadata.uri == uri);
    });
});
