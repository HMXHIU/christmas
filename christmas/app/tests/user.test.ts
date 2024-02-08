import { Keypair } from "@solana/web3.js";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { ObjectStorage } from "$lib/server/objectStorage";
import { expect, test } from "vitest";
import { createSignInMessage } from "@solana/wallet-standard-util";

import nacl from "tweetnacl";

test("Test Login", async () => {
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

    const loginResult = await fetch("http://localhost:5173/api/auth/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            solanaSignInInput,
            solanaSignInOutput,
        }),
    });

    const { status, token } = await loginResult.json();

    expect(
        (jwt.decode(token, { complete: true })?.payload as JwtPayload)
            .publicKey,
    ).toEqual(user.publicKey.toBase58());
    expect(status).toBe("success");
});

test("Test User API", async () => {
    // login
    const user = Keypair.generate();

    const solanaSignInInput = await (
        await fetch("http://localhost:5173/api/auth/siws")
    ).json();

    const signInMessage = createSignInMessage(solanaSignInInput);

    // replicate solana.signIn
    const solanaSignInOutput = {
        address: user.publicKey.toBase58(),
        signature: Buffer.from(
            nacl.sign.detached(signInMessage, user.secretKey),
        ),
        signedMessage: Buffer.from(signInMessage),
    };

    const loginResult = await fetch("http://localhost:5173/api/auth/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            solanaSignInInput,
            solanaSignInOutput,
        }),
    });

    console.log(JSON.stringify(await loginResult.json(), null, 2));

    // fetch("/api/auth/login", {
    //     method: "POST",
    //     body: JSON.stringify({ publicKey: user.publicKey }),
});
