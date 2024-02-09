import { Keypair } from "@solana/web3.js";
import { expect, test } from "vitest";

import { login } from "./auth.test";
import { getCookiesFromResponse } from "./utils";
import { PUBLIC_HOST } from "$env/static/public";

test("Test Store API", async () => {
    const user = Keypair.generate();

    // Login
    let response = await login(user);
    const cookies = getCookiesFromResponse(response);

    // Create store metadata
    response = await fetch(`${PUBLIC_HOST}/api/store/create`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Cookie: cookies,
        },
        body: JSON.stringify({
            name: user.publicKey.toBase58(),
            description: user.publicKey.toBase58(),
            image: `http://example.com/${user.publicKey.toBase58()}`,
            address: user.publicKey.toBase58(),
            latitude: 123,
            longitude: 456,
        }),
    });

    // Check response
    const createStoreMetadataResult = await response.json();
    console.log(JSON.stringify(createStoreMetadataResult, null, 2));
    expect(createStoreMetadataResult.status).toBe("success");

    // Check metadata
    response = await fetch(createStoreMetadataResult.url);
    await expect(response.json()).resolves.toEqual({
        name: user.publicKey.toBase58(),
        description: user.publicKey.toBase58(),
        image: `http://example.com/${user.publicKey.toBase58()}`,
        address: user.publicKey.toBase58(),
        latitude: 123,
        longitude: 456,
    });
});
