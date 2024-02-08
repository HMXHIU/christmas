import { Keypair } from "@solana/web3.js";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { expect, test } from "vitest";
import { createSignInMessage } from "@solana/wallet-standard-util";
import nacl from "tweetnacl";
import { getCookiesFromResponse } from "./utils";

test("Test Auth", async () => {
    const user = Keypair.generate();

    // get SIWS sign in message
    const solanaSignInInput = await (
        await fetch("http://localhost:5173/api/auth/siws")
    ).json();
    const signInMessage = createSignInMessage(solanaSignInInput);

    // Replicate solana.signIn
    const solanaSignInOutput = {
        address: user.publicKey.toBase58(),
        signature: Buffer.from(
            nacl.sign.detached(signInMessage, user.secretKey),
        ),
        signedMessage: Buffer.from(signInMessage),
    };

    // Login
    let response = await fetch("http://localhost:5173/api/auth/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            solanaSignInInput,
            solanaSignInOutput,
        }),
    });
    const loginResult = await response.json();

    expect(
        (
            jwt.decode(loginResult.token, { complete: true })
                ?.payload as JwtPayload
        ).publicKey,
    ).toEqual(user.publicKey.toBase58());
    expect(loginResult.status).toBe("success");

    const cookies = getCookiesFromResponse(response);

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
