import { AnchorClient } from "../app/src/lib/anchorClient";
import * as anchor from "@coral-xyz/anchor";

import chai from "chai";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
import { assert, expect } from "chai";

import { login } from "./utils";
import { getCookiesFromResponse } from "../app/tests/utils";
import { Keypair } from "@solana/web3.js";
import { signUp } from "../app/src/lib/crossover";

describe("Test User", () => {
    // Create user keypair and anchor client
    const name = "John Doe";
    const userKeypair = Keypair.generate();
    let anchorClient = new AnchorClient({
        keypair: userKeypair,
    });

    // Store cookies for login session
    let cookies;

    it("Test Login", async () => {
        const response = await login(userKeypair);
        cookies = getCookiesFromResponse(response);
    });

    it("Test Fail Sign Up", async () => {
        expect(signUp({ name }, { Cookie: cookies })).to.be.rejectedWith(
            `User account ${userKeypair.publicKey.toBase58()} does not exist`
        );
    });

    it("Test Sign Up", async () => {
        // Create user
    });
});
