import { Keypair } from "@solana/web3.js";
import { expect, test } from "vitest";

import { login } from "./auth.test";
import { getCookiesFromResponse, readImageAsBuffer } from "./utils";
import { PUBLIC_HOST } from "$env/static/public";

test("Test Image Storage", async () => {
    const user = Keypair.generate();

    // Login
    let response = await login(user);
    const cookies = getCookiesFromResponse(response);

    // Read image from ../static/demo/assets/coupon_cat.jpeg
    const imageBuffer = readImageAsBuffer(
        "../static/demo/assets/coupon_cat.jpeg",
    );
    const image = new Blob([imageBuffer], { type: "image/jpeg" });

    // Upload image
    response = await fetch(`${PUBLIC_HOST}/api/storage/image/public`, {
        method: "POST",
        headers: {
            Cookie: cookies,
            "Content-Type": "image/jpeg",
        },
        body: image,
    });

    // Check response
    const createImageResult = await response.json();
    expect(createImageResult.status).toBe("success");

    // Check image
    response = await fetch(createImageResult.url);
    const blob = await response.blob();
    expect(blob).toEqual(image);
    expect(blob.type).toBe("image/jpeg");
});
