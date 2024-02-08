import { Keypair } from "@solana/web3.js";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { ObjectStorage } from "$lib/server/objectStorage";
import { expect, test } from "vitest";
import { createSignInMessage } from "@solana/wallet-standard-util";

import nacl from "tweetnacl";
import { login } from "./auth.test";
import { getCookiesFromResponse } from "./utils";
import { PUBLIC_HOST } from "$env/static/public";
import { json } from "stream/consumers";

test("Test User API", async () => {
    const user = Keypair.generate();

    // Login
    let response = await login(user);
    const cookies = getCookiesFromResponse(response);

    // Initialize user
    response = await fetch("http://localhost:5173/api/user/init", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Cookie: cookies,
        },
    });
    const initResult = await response.json();
    expect(initResult).toEqual({
        status: "success",
        url: `${PUBLIC_HOST}/api/storage/user/public/${user.publicKey.toBase58()}`,
    });

    // Get user metadata
    response = await fetch(initResult.url);
    const metadata = await response.json();
    expect(metadata).toEqual({
        publicKey: user.publicKey.toBase58(),
    });

    // Reinitialize user
    response = await fetch("http://localhost:5173/api/user/init", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Cookie: cookies,
        },
    });
    const reinitResult = await response.json();
    expect(reinitResult).toEqual({
        status: "error",
        message: "User is already initialized",
    });
});
