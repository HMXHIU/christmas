import { Keypair } from "@solana/web3.js";

import { ObjectStorage } from "$lib/server/objectStorage";
import { expect, test } from "vitest";

test("Test Public Object Storage", async () => {
    // owner = null for public object
    const publicData = {
        name: "tile1",
    };
    const publicData2 = {
        name: "tile2",
    };

    // Create public object
    await ObjectStorage.putObject({
        owner: null,
        bucket: "user",
        name: "tile1",
        data: JSON.stringify(publicData),
    });

    await ObjectStorage.putJSONObject({
        owner: null,
        bucket: "user",
        name: "tile2",
        data: publicData2,
    });

    // Object url
    expect(
        ObjectStorage.objectUrl({
            owner: null,
            bucket: "user",
            name: "tile1",
        }),
    ).toEqual("http://127.0.0.1:9000/user/public/tile1");

    // Public object exists
    await expect(
        ObjectStorage.objectExists({
            owner: null,
            bucket: "user",
            name: "tile1",
        }),
    ).resolves.toBe(true);

    await expect(
        ObjectStorage.objectExists({
            owner: null,
            bucket: "user",
            name: "tile2",
        }),
    ).resolves.toBe(true);

    await expect(
        ObjectStorage.objectExists({
            owner: "doesnotexists",
            bucket: "user",
            name: "tile1",
        }),
    ).rejects.toThrowError();

    await expect(
        ObjectStorage.objectExists({
            owner: null,
            bucket: "user",
            name: "notile",
        }),
    ).resolves.toBe(false);
});

test("Test Private Object Storage", async () => {
    const keypair = Keypair.generate();
    const owner = keypair.publicKey.toBase58();
    const privateData = {
        publicKey: owner,
    };

    // Create private object
    await ObjectStorage.putObject({
        owner,
        bucket: "user",
        name: owner,
        data: JSON.stringify(privateData),
    });

    // Object url
    expect(
        ObjectStorage.objectUrl({
            owner,
            bucket: "user",
            name: owner,
        }),
    ).toEqual(`http://127.0.0.1:9000/user/private/${owner}`);

    // Private object exists
    await expect(
        ObjectStorage.objectExists({
            owner,
            bucket: "user",
            name: owner,
        }),
    ).resolves.toBe(true);

    await expect(
        ObjectStorage.objectExists({
            owner: null,
            bucket: "user",
            name: owner,
        }),
    ).resolves.toBe(false);

    await expect(
        ObjectStorage.objectExists({
            owner: "doesnotexists",
            bucket: "user",
            name: owner,
        }),
    ).rejects.toThrowError();

    // Get object
    const readable = await ObjectStorage.getObject({
        owner,
        name: owner,
        bucket: "user",
    });
    expect(JSON.parse(await readable.read())).toEqual(privateData);

    // Get JSON object
    await expect(
        ObjectStorage.getJSONObject({ owner, name: owner, bucket: "user" }),
    ).resolves.toEqual(privateData);

    // Get permission denied
    await expect(
        ObjectStorage.getJSONObject({
            owner,
            name: "doesnotexsits",
            bucket: "user",
        }),
    ).rejects.toThrowError();
});