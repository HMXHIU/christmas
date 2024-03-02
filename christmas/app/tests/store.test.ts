import { createStore, fetchStoreMetadata, fetchStores } from "$lib/community";
import { COUNTRY_DETAILS } from "$lib/userDeviceClient/defs";
import { stringToUint8Array } from "$lib/utils";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { Keypair, PublicKey } from "@solana/web3.js";
import ngeohash from "ngeohash";
import { expect, test } from "vitest";
import { getCookiesFromResponse, login, readImageAsBuffer } from "./utils";

test("Test Store", async () => {
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
    const tx = await createStore(
        {
            name: "store",
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

    expect(tx.result.err).toBeNull();

    // Fetch store
    const stores = await fetchStores({ Cookie: cookies });
    expect(stores.length).toBe(1);
    expect(stores[0].account).toMatchObject({
        name: "store",
        region: stringToUint8Array(regionCode),
        geohash: stringToUint8Array(geohash),
        owner: user.publicKey.toBase58(),
    });

    // Fetch store metadata
    const storeMetadata = await fetchStoreMetadata(
        new PublicKey(stores[0].publicKey),
        { Cookie: cookies },
    );
    expect(storeMetadata).toMatchObject(
        await (await fetch(stores[0].account.uri)).json(),
    );
    expect(storeMetadata).toMatchObject({
        name: "store",
        description: user.publicKey.toBase58(),
        address: user.publicKey.toBase58(),
        latitude,
        longitude,
    });

    // Fetch Image
    response = await fetch(storeMetadata.image);
    await expect(response.blob()).resolves.toEqual(image);
});
