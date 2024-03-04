import { createStore, fetchStoreMetadata, fetchStores } from "$lib/community";
import { stringToUint8Array } from "$lib/utils";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { Keypair, PublicKey } from "@solana/web3.js";
import ngeohash from "ngeohash";
import { expect, test } from "vitest";
import {
    getCookiesFromResponse,
    getRandomRegion,
    login,
    readImageAsBuffer,
    readImageAsDataUrl,
} from "../utils";

test("Test Store", async () => {
    const user = Keypair.generate();
    const userWallet = new NodeWallet(user);

    // Login
    let response = await login(user);
    const cookies = getCookiesFromResponse(response);

    // Read image from ../static/demo/assets/coupon_cat.jpeg
    const imagePath = "../static/demo/assets/coupon_cat.jpeg";
    const imageDataUrl = await readImageAsDataUrl(imagePath);
    const imageBlob = new Blob([readImageAsBuffer(imagePath)], {
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
    const { latitude, longitude } = ngeohash.decode(geohash);
    const region = getRandomRegion();

    // Create store
    const tx = await createStore(
        {
            name: "store",
            description: user.publicKey.toBase58(),
            address: user.publicKey.toBase58(),
            region,
            latitude,
            longitude,
            geohash: Array.from(stringToUint8Array(geohash)),
            image: imageDataUrl,
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
        region: region,
        geohash: Array.from(stringToUint8Array(geohash)),
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
    await expect(response.blob()).resolves.toEqual(imageBlob);
});
