import { Keypair } from "@solana/web3.js";
import { expect, test } from "vitest";

import { login } from "./auth.test";
import { getCookiesFromResponse } from "./utils";
import { PUBLIC_HOST } from "$env/static/public";

test("Test User Storage", async () => {
    const user = Keypair.generate();

    // Login
    let response = await login(user);
    const cookies = getCookiesFromResponse(response);

    // Create user metadata
    let data = {
        publicKey: user.publicKey.toBase58(),
    };

    response = await fetch(`${PUBLIC_HOST}/api/storage/user/public`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Cookie: cookies,
        },
        body: JSON.stringify(data),
    });

    // Check response
    const createUserMetadataResult = await response.json();
    expect(createUserMetadataResult.status).toBe("success");

    // Check metadata
    response = await fetch(createUserMetadataResult.url);
    await expect(response.json()).resolves.toEqual({
        publicKey: user.publicKey.toBase58(),
    });
});

test("Test Coupon Storage", async () => {
    const user = Keypair.generate();

    // Login
    let response = await login(user);
    const cookies = getCookiesFromResponse(response);

    // Create coupon metadata
    let data = {
        name: user.publicKey.toBase58(),
        description: user.publicKey.toBase58(),
        image: `http://example.com/${user.publicKey.toBase58()}`,
    };

    response = await fetch(`${PUBLIC_HOST}/api/storage/coupon/public`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Cookie: cookies,
        },
        body: JSON.stringify(data),
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

test("Test Store Storage", async () => {
    const user = Keypair.generate();

    // Login
    let response = await login(user);
    const cookies = getCookiesFromResponse(response);

    // Create store metadata
    let data = {
        name: user.publicKey.toBase58(),
        description: user.publicKey.toBase58(),
        image: `http://example.com/${user.publicKey.toBase58()}`,
        address: user.publicKey.toBase58(),
        latitude: 123,
        longitude: 456,
    };
    response = await fetch(`${PUBLIC_HOST}/api/storage/store/public`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Cookie: cookies,
        },
        body: JSON.stringify(data),
    });

    // Check response
    const createStoreMetadataResult = await response.json();
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
