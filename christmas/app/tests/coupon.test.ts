import { Keypair } from "@solana/web3.js";
import { expect, test } from "vitest";

import { login } from "./auth.test";
import { getCookiesFromResponse } from "./utils";
import { PUBLIC_HOST } from "$env/static/public";

test("Test Coupon API", async () => {
    const user = Keypair.generate();

    // Login
    let response = await login(user);
    const cookies = getCookiesFromResponse(response);

    // Create coupon metadata
    response = await fetch(`${PUBLIC_HOST}/api/coupon/create`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Cookie: cookies,
        },
        body: JSON.stringify({
            name: user.publicKey.toBase58(),
            description: user.publicKey.toBase58(),
            image: `http://example.com/${user.publicKey.toBase58()}`,
        }),
    });

    // Check response
    const createCouponMetadataResult = await response.json();
    expect(createCouponMetadataResult.status).toBe("success");

    // Check metadata
    response = await fetch(createCouponMetadataResult.url);
    await expect(response.json()).resolves.toEqual({
        name: user.publicKey.toBase58(),
        description: user.publicKey.toBase58(),
        image: `http://example.com/${user.publicKey.toBase58()}`,
    });
});
