import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Christmas } from "../target/types/christmas";
import { web3 } from "@coral-xyz/anchor";
import {
    requestAirdrop,
    setupAnchor,
    createUser,
    createStore,
    cleanString,
} from "./utils";
import { assert } from "chai";

describe("Test Account Creation", () => {
    const [provider, program] = setupAnchor();
    const keypair = anchor.web3.Keypair.generate();

    it("Airdrop", async () => {
        await requestAirdrop([keypair.publicKey], 10e9);
    });

    it("Create User", async () => {
        const region = "SGP";
        const geohash = "w21zdj";

        const [userPda, userBump] = await createUser(keypair, region, geohash);
        const user = await program.account.user.fetch(userPda);

        assert.equal(cleanString(user.region), region);
        assert.equal(cleanString(user.geo), geohash);
    });

    it("Create Store", async () => {
        const region = "SGP";
        const geohash = "w21zdj";
        const uri = "https://example.com";
        const storeName = "example.com";

        const [storePda, storeBump] = await createStore(
            keypair,
            storeName,
            region,
            geohash,
            uri
        );
        const store = await program.account.store.fetch(storePda);

        assert.equal(cleanString(store.name), storeName);
        assert.equal(cleanString(store.region), region);
        assert.equal(cleanString(store.uri), uri);
        assert.equal(cleanString(store.geo), geohash);
    });
});
