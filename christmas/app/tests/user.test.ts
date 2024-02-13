import { Keypair } from "@solana/web3.js";
import { expect, test } from "vitest";
import { login } from "./auth.test";
import { getCookiesFromResponse } from "./utils";
import { PUBLIC_HOST } from "$env/static/public";

test("Test Player Sign Up", async () => {
    const user = Keypair.generate();

    // Login
    let response = await login(user);
    const cookies = getCookiesFromResponse(response);

    // Sign up
    const name = "John Doe";
    response = await fetch(`${PUBLIC_HOST}/api/crossover/auth/signup`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Cookie: cookies,
        },
        body: JSON.stringify({ name }),
    });

    // Check cannot sign up player if user account does not exist
    expect(response.ok).toBe(false);
    await expect(response.json()).resolves.toEqual({
        message: `User account ${user.publicKey.toBase58()} does not exist`,
    });

    // Create user account
});
