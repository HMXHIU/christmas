import { Keypair } from "@solana/web3.js";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { expect, test } from "vitest";
import { createSignInMessage } from "@solana/wallet-standard-util";
import nacl from "tweetnacl";
import { getCookiesFromResponse } from "./utils";

/**
 * Login without a browser, without SIWS (required for tests)
 */
export async function login(user: Keypair): Promise<Response> {
    const solanaSignInInput = await (
        await fetch("http://localhost:5173/api/auth/siws")
    ).json();
    const signInMessage = createSignInMessage(solanaSignInInput);
    const solanaSignInOutput = {
        address: user.publicKey.toBase58(),
        signature: Buffer.from(
            nacl.sign.detached(signInMessage, user.secretKey),
        ),
        signedMessage: Buffer.from(signInMessage),
    };
    return await fetch("http://localhost:5173/api/auth/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            solanaSignInInput,
            solanaSignInOutput,
        }),
    });
}

test("Test Auth", async () => {
    const user = Keypair.generate();

    // Login
    let response = await login(user);
    const loginResult = await response.json();
    const cookies = getCookiesFromResponse(response);

    expect(
        (
            jwt.decode(loginResult.token, { complete: true })
                ?.payload as JwtPayload
        ).publicKey,
    ).toEqual(user.publicKey.toBase58());
    expect(loginResult.status).toBe("success");

    // Refresh
    const refreshResult = await (
        await fetch("http://localhost:5173/api/auth/refresh", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Cookie: cookies,
            },
        })
    ).json();

    expect(
        (
            jwt.decode(refreshResult.token, { complete: true })
                ?.payload as JwtPayload
        ).publicKey,
    ).toEqual(user.publicKey.toBase58());
    expect(refreshResult.status).toBe("success");

    // Logout
    const logoutResult = await (
        await fetch("http://localhost:5173/api/auth/logout", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Cookie: cookies,
            },
        })
    ).json();
    expect(logoutResult.status).toBe("success");
});
