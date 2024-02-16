import { Keypair, PublicKey } from "@solana/web3.js";
import { expect, test } from "vitest";
import ngeohash from "ngeohash";
import { login } from "./auth.test";
import { getCookiesFromResponse, readImageAsBuffer } from "./utils";
import {
    createStore,
    createUser,
    fetchStoreMetadata,
    fetchStores,
    fetchUser,
    fetchUserMetadata,
} from "$lib/community";
import { stringToUint8Array } from "$lib/utils";
import { COUNTRY_DETAILS } from "$lib/clients/user-device-client/defs";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";

test("Test User", async () => {
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

    // Create user
    let tx = await createUser(
        { region: regionCode },
        {
            headers: { Cookie: cookies },
            wallet: userWallet,
        },
    );
    expect(tx.result.err).toBe(null);

    // Fetch user
    const createdUser = await fetchUser({ Cookie: cookies });
    expect(createdUser).not.toBe(null);
    expect(createdUser).toMatchObject({
        region: Array.from(stringToUint8Array(regionCode)),
    });

    // Fetch user metadata
    const userMetadata = await fetchUserMetadata(createdUser!, {
        Cookie: cookies,
    });
    expect(userMetadata).not.toBe(null);
    expect(userMetadata).toMatchObject({
        publicKey: user.publicKey.toBase58(),
    });
});
