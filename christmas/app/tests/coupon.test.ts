import { Keypair } from "@solana/web3.js";
import { expect, test } from "vitest";
import ngeohash from "ngeohash";
import { login } from "./auth.test";
import { getCookiesFromResponse, readImageAsBuffer } from "./utils";
import { PUBLIC_HOST } from "$env/static/public";
import { createCoupon, createStore } from "$lib/community";
import { stringToUint8Array } from "$lib/utils";
import { COUNTRY_DETAILS } from "$lib/clients/user-device-client/defs";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";

test("Test Create Coupon", async () => {
    const user = Keypair.generate();
    const userWallet = new NodeWallet(user);

    // Login
    let response = await login(user);
    const cookies = getCookiesFromResponse(response);

    // Read image from ../static/demo/assets/coupon_cat.jpeg
    const imageBuffer = readImageAsBuffer(
        "../static/demo/assets/coupon_cat.jpeg",
    );
    const image = new Blob([imageBuffer], { type: "image/jpeg" });
    const imageFile = new File([image], "coupon_cat.jpeg", {
        type: "image/jpeg",
    });

    // Dates
    const today = new Date();
    const afterToday = new Date(today);
    afterToday.setMonth(afterToday.getMonth() + 3);
    const beforeToday = new Date(today);
    beforeToday.setMonth(beforeToday.getMonth() - 3);

    // Locations
    const geohash = "gbsuv7";
    const regionIdx = Math.floor(
        Math.random() * Object.values(COUNTRY_DETAILS).length,
    );
    const regionCode = Object.values(COUNTRY_DETAILS)[regionIdx][0];
    const { latitude, longitude } = ngeohash.decode(
        String.fromCharCode(...Array.from(stringToUint8Array(geohash))),
    );

    // Create store
    const store = await createStore(
        {
            name: user.publicKey.toBase58(),
            description: user.publicKey.toBase58(),
            address: user.publicKey.toBase58(),
            region: regionCode,
            latitude,
            longitude,
            geohash,
            logo: imageFile,
        },
        {
            headers: { Cookie: cookies },
            wallet: userWallet,
        },
    );

    // createCoupon({
    //     image: imageFile,
    //     name: user.publicKey.toBase58(),
    //     description: user.publicKey.toBase58(),
    //     validFrom: beforeToday,
    //     validTo: afterToday,
    //     store,
    // });

    // // Upload image
    // response = await fetch(`${PUBLIC_HOST}/api/storage/image/public`, {
    //     method: "POST",
    //     headers: {
    //         Cookie: cookies,
    //         "Content-Type": "image/jpeg",
    //     },
    //     body: image,
    // });

    // // Check response
    // const createImageResult = await response.json();
    // expect(createImageResult.status).toBe("success");

    // // Check image
    // response = await fetch(createImageResult.url);
    // const blob = await response.blob();
    // expect(blob).toEqual(image);
    // expect(blob.type).toBe("image/jpeg");
});
