import { Keypair, PublicKey } from "@solana/web3.js";
import { expect, test } from "vitest";
import ngeohash from "ngeohash";
import { login } from "./auth.test";
import { getCookiesFromResponse, readImageAsBuffer } from "./utils";
import {
    claimCoupon,
    createCoupon,
    createStore,
    fetchClaimedCoupons,
    fetchCouponMetadata,
    fetchMintedCouponSupplyBalance,
    fetchStoreMetadata,
    fetchStores,
    fetchUser,
    fetchUserMetadata,
    mintCoupon,
    redeemCoupon,
} from "$lib/community";
import { stringToUint8Array } from "$lib/utils";
import { COUNTRY_DETAILS } from "$lib/clients/user-device-client/defs";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { BN } from "bn.js";
import exp from "constants";

test("Test Coupon", async () => {
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
    let tx = await createStore(
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
    console.log(tx.result.err);
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

    // Create coupon
    tx = await createCoupon(
        {
            image: imageFile,
            name: "coupon",
            description: user.publicKey.toBase58(),
            validFrom: beforeToday,
            validTo: afterToday,
            store: stores[0],
        },
        {
            headers: { Cookie: cookies },
            wallet: userWallet,
        },
    );
    expect(tx.result.err).toBeNull();

    // Fetch coupon
    let coupons = await fetchMintedCouponSupplyBalance(stores[0].publicKey, {
        Cookie: cookies,
    });
    expect(coupons.length).toBe(1);
    let [coupon, supply, balance] = coupons[0];
    expect(supply).toBe(0);
    expect(balance).toBe(0);
    expect(coupon.account).toMatchObject({
        name: "coupon",
        updateAuthority: user.publicKey.toBase58(),
        store: stores[0].publicKey,
        region: stringToUint8Array(regionCode),
        geohash: stringToUint8Array(geohash),
        validFrom: new BN(beforeToday.getTime()),
        validTo: new BN(afterToday.getTime()),
    });

    // Fetch coupon metadata
    const metadata = await fetchCouponMetadata(coupon, {
        Cookie: cookies,
    });
    expect(metadata).toMatchObject({
        name: "coupon",
        description: user.publicKey.toBase58(),
    });

    // Fetch coupon image
    const imageBlob = await (await fetch(metadata.image)).blob();
    expect(imageBlob).toMatchObject(image);

    // Mint coupon
    tx = await mintCoupon(
        {
            coupon: coupon,
            numTokens: 2,
        },
        {
            headers: { Cookie: cookies },
            wallet: userWallet,
        },
    );
    expect(tx.result.err).toBeNull();

    // Fetch coupon supply balance
    coupons = await fetchMintedCouponSupplyBalance(stores[0].publicKey, {
        Cookie: cookies,
    });
    expect(coupons.length).toBe(1);
    [coupon, supply, balance] = coupons[0];
    expect(supply).toBe(2);
    expect(balance).toBe(2);

    // Claim coupon (to UserSession's UserAccount)
    tx = await claimCoupon(
        {
            coupon,
            numTokens: 1,
        },
        {
            headers: { Cookie: cookies },
            wallet: userWallet,
        },
    );

    // Check UserSession's UserAccount created
    const createdUser = await fetchUser({ Cookie: cookies });
    expect(createdUser).toMatchObject({
        region: stringToUint8Array(regionCode),
    });

    // Check coupon supply balance
    coupons = await fetchMintedCouponSupplyBalance(stores[0].publicKey, {
        Cookie: cookies,
    });
    expect(coupons.length).toBe(1);
    [coupon, supply, balance] = coupons[0];
    expect(supply).toBe(2);
    expect(balance).toBe(1);

    // Check claimed coupons
    let claimedCoupons = await fetchClaimedCoupons({ Cookie: cookies });
    expect(claimedCoupons.length).toBe(1);
    [coupon, balance] = claimedCoupons[0];
    expect(balance).toBe(1);
    expect(coupon.account.name).toBe("coupon");

    // Redeem coupon
    tx = await redeemCoupon(
        {
            coupon,
            numTokens: 1,
        },
        {
            headers: { Cookie: cookies },
            wallet: userWallet,
        },
    );
    expect(tx.result.err).toBeNull();

    // Check claimed coupons after redeeming
    claimedCoupons = await fetchClaimedCoupons({ Cookie: cookies });
    expect(claimedCoupons.length).toBe(0);

    // TODO: test fetchMarketCoupons
});
