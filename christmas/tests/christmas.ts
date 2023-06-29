import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Christmas } from "../target/types/christmas";
import { web3 } from "@coral-xyz/anchor";
import { assert, expect } from "chai";
import {
    stringToUint8Array,
    getCouponPda,
    getRegionMarketPda,
    getUserPda,
} from "./utils";
import { sha256 } from "js-sha256";
import {
    TOKEN_PROGRAM_ID,
    getAssociatedTokenAddress,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getMint,
} from "@solana/spl-token";

import { requestAirdrop } from "./utils";

describe("christmas", () => {
    // Configure the client to use the local cluster.
    anchor.setProvider(anchor.AnchorProvider.env());

    const provider = anchor.getProvider();
    const program = anchor.workspace.Christmas as Program<Christmas>;
    const user = anchor.web3.Keypair.generate();

    console.log(`program: ${web3.SystemProgram.programId}`);
    console.log(`user: ${user.publicKey}`);

    it("Airdrop some sol for transactions", async () => {
        await requestAirdrop([user.publicKey], 100e9);
    });

    it("Create user", async () => {
        let email = "user@gmail.com";
        let geo = "gbsuv7";
        let region = "SGP";

        // Calculate userPda
        const userPda = getUserPda(user.publicKey, program.programId)[0];

        // Create user
        const tx = await program.methods
            .createUser(email, region, geo)
            .accounts({
                user: userPda,
                signer: user.publicKey,
                systemProgram: web3.SystemProgram.programId,
            })
            .signers([user])
            .rpc();

        // Check account is created correctly
        let _user = await program.account.user.fetch(userPda);
        assert.ok(_user.geo == geo);
        assert.ok(_user.region == region);
        let twoFactor = sha256.digest([
            ...user.publicKey.toBytes(),
            ...stringToUint8Array(email),
        ]);
        expect(twoFactor).to.deep.equal(_user.twoFactor);
    });

    describe("Coupons", () => {
        let geo = "gbsuv7";
        let region = "SGP";
        let name = "Candy";
        let symbol = "CNDY #1";
        let uri = "https://path/to/json";

        // Generate mint keypair
        const mint = anchor.web3.Keypair.generate();

        // Calculate couponPda
        const couponPda = getCouponPda(mint.publicKey, program.programId)[0];

        // Calculate regionMarketPda
        const regionMarketPda = getRegionMarketPda(
            region,
            program.programId
        )[0];

        it("Create coupon mint", async () => {
            const tx = await program.methods
                .createCoupon(name, symbol, region, geo, uri)
                .accounts({
                    mint: mint.publicKey,
                    coupon: couponPda,
                    signer: user.publicKey,
                    systemProgram: web3.SystemProgram.programId,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .signers([user, mint])
                .rpc();

            // Check account is created correctly
            let _coupon = await program.account.coupon.fetch(couponPda);
            assert.ok(_coupon.updateAuthority.equals(user.publicKey));
            assert.ok(_coupon.geo == geo);
            assert.ok(_coupon.region == region);
            assert.ok(_coupon.name == name);
            assert.ok(_coupon.symbol == symbol);
            assert.ok(_coupon.uri == uri);
        });

        it("Mint to region market", async () => {
            // Calculate regionMarketTokenAccount
            const regionMarketTokenAccount = await getAssociatedTokenAddress(
                mint.publicKey,
                regionMarketPda,
                true // allowOwnerOffCurve - Allow the owner account to be a PDA (Program Derived Address)
            );

            // Check mint supply before
            const mintSupplyBefore = (
                await getMint(provider.connection, mint.publicKey)
            ).supply;

            const numToMint = 1;

            // Mint to region market
            const tx = await program.methods
                .mintToMarket(region, new anchor.BN(numToMint))
                .accounts({
                    regionMarket: regionMarketPda,
                    regionMarketTokenAccount: regionMarketTokenAccount,
                    mint: mint.publicKey,
                    signer: user.publicKey,
                    systemProgram: web3.SystemProgram.programId,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                })
                .signers([user])
                .rpc();

            // Check regionMarket created
            let regionMarket = await program.account.regionMarket.fetch(
                regionMarketPda
            );
            assert.equal(regionMarket.region, region);

            // Check regionMarketATA has minted tokens
            const regionMarketATA = (
                await provider.connection.getParsedTokenAccountsByOwner(
                    regionMarketPda, // region market is the owner of the ATA
                    {
                        programId: TOKEN_PROGRAM_ID,
                        mint: mint.publicKey, // the mint of the ATA
                    }
                )
            ).value[0].account.data.parsed;
            assert.equal(regionMarketATA["info"]["tokenAmount"]["amount"], "1");

            // Check mint supply after
            const mintSupplyAfter = (
                await getMint(provider.connection, mint.publicKey)
            ).supply;

            assert.equal(Number(mintSupplyAfter - mintSupplyBefore), numToMint);
        });

        it("Claim from market", async () => {
            // Calculate regionMarketTokenAccount
            const regionMarketTokenAccount = await getAssociatedTokenAddress(
                mint.publicKey,
                regionMarketPda,
                true // allowOwnerOffCurve - Allow the owner account to be a PDA (Program Derived Address)
            );

            // Calculate userPda
            const userPda = getUserPda(user.publicKey, program.programId)[0];

            // Calculate userTokenAccount (this is owned by the userPda not the user)
            const userTokenAccount = await getAssociatedTokenAddress(
                mint.publicKey,
                userPda, // userPda not user
                true // allowOwnerOffCurve - Allow the owner account to be a PDA (Program Derived Address)
            );

            // Calculate couponPda
            let couponPda = getCouponPda(mint.publicKey, program.programId)[0];

            const numToClaim = 1;

            // userTokenAccount does not exist at this point

            const tx = await program.methods
                .claimFromMarket(new anchor.BN(numToClaim))
                .accounts({
                    user: userPda,
                    userTokenAccount: userTokenAccount,
                    regionMarket: regionMarketPda,
                    regionMarketTokenAccount: regionMarketTokenAccount,
                    coupon: couponPda,
                    mint: mint.publicKey,
                    signer: user.publicKey,
                    systemProgram: web3.SystemProgram.programId,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                })
                .signers([user])
                .rpc();

            // Check userTokenAccount balance after
            const balanceAfter =
                await provider.connection.getTokenAccountBalance(
                    userTokenAccount
                );
            assert.equal(balanceAfter.value.amount, `${numToClaim}`);
        });
    });
});
