import { Keypair } from "@solana/web3.js";

import { PUBLIC_HOST } from "$env/static/public";
import { ObjectStorage } from "$lib/server/objectStorage";
import { expect, test } from "vitest";

test("Test Public Object Storage", async () => {
    const publicData = {
        name: "tile1",
    };
    const publicData2 = {
        name: "tile2",
    };

    // Test putObject, putJSONObject
    await expect(
        ObjectStorage.putObject({
            owner: null, // owner = null for public object
            bucket: "user",
            name: "tile1",
            data: JSON.stringify(publicData),
        }),
    ).resolves.toEqual(`${PUBLIC_HOST}/api/storage/user/public/tile1`);

    await expect(
        ObjectStorage.putJSONObject({
            owner: null,
            bucket: "user",
            name: "tile2",
            data: publicData2,
        }),
    ).resolves.toEqual(`${PUBLIC_HOST}/api/storage/user/public/tile2`);

    // Test objectExists
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

    // Test listObjects
    let bucketItems = await ObjectStorage.listObjects({
        owner: null,
        bucket: "user",
        maxKeys: 2,
    });
    expect(bucketItems.length).toBe(2);

    bucketItems = await ObjectStorage.listObjects({
        owner: null,
        bucket: "user",
        maxKeys: 2,
        prefix: "tile",
    });
    expect(bucketItems.map((item) => item.name)).toMatchObject([
        "public/tile1",
        "public/tile2",
    ]);

    bucketItems = await ObjectStorage.listObjects({
        owner: null,
        bucket: "user",
        maxKeys: 1,
        prefix: "tile",
    });
    expect(bucketItems.map((item) => item.name)).toMatchObject([
        "public/tile1",
    ]);

    // Test renameObject
    await expect(
        ObjectStorage.renameObject({
            owner: null,
            bucket: "user",
            oldName: "tile2",
            newName: "tile3",
        }),
    ).resolves.toBe(`${PUBLIC_HOST}/api/storage/user/public/tile3`);
    await expect(
        ObjectStorage.objectExists({
            owner: null,
            bucket: "user",
            name: "tile2",
        }),
    ).resolves.toBe(false);
    await expect(
        ObjectStorage.objectExists({
            owner: null,
            bucket: "user",
            name: "tile3",
        }),
    ).resolves.toBe(true);
    await expect(
        ObjectStorage.renameObject({
            owner: null,
            bucket: "user",
            oldName: "tile3",
            newName: "tile2",
        }),
    ).resolves.toBe(`${PUBLIC_HOST}/api/storage/user/public/tile2`);
    await expect(
        ObjectStorage.objectExists({
            owner: null,
            bucket: "user",
            name: "tile3",
        }),
    ).resolves.toBe(false);
    await expect(
        ObjectStorage.objectExists({
            owner: null,
            bucket: "user",
            name: "tile2",
        }),
    ).resolves.toBe(true);

    // Test copyObject
    await ObjectStorage.copyObject({
        sourceOwner: null,
        sourceBucket: "user",
        sourceName: "tile2",
        destOwner: null,
        destBucket: "user",
        destName: "tile3",
    });
    await expect(
        ObjectStorage.objectExists({
            owner: null,
            bucket: "user",
            name: "tile2",
        }),
    ).resolves.toBe(true);
    await expect(
        ObjectStorage.objectExists({
            owner: null,
            bucket: "user",
            name: "tile3",
        }),
    ).resolves.toBe(true);

    // Test deleteObject
    await ObjectStorage.deleteObject({
        owner: null,
        bucket: "user",
        name: "tile3",
    });
    await expect(
        ObjectStorage.objectExists({
            owner: null,
            bucket: "user",
            name: "tile3",
        }),
    ).resolves.toBe(false);
});

test("Test Private Object Storage", async () => {
    const keypair = Keypair.generate();
    const owner = keypair.publicKey.toBase58();
    const privateData = {
        publicKey: owner,
    };

    // Test putObject, putJSONObject
    await expect(
        ObjectStorage.putObject({
            owner,
            bucket: "user",
            name: owner,
            data: JSON.stringify(privateData),
        }),
    ).resolves.toEqual(`${PUBLIC_HOST}/api/storage/user/private/${owner}`);

    // Test objectExists
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

    // Test getObject, getJSONObject
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

    // Test listObjects
    let bucketItems = await ObjectStorage.listObjects({
        owner,
        bucket: "user",
        prefix: owner,
        maxKeys: 2,
    });
    expect(bucketItems.length).toBe(1);
    expect(bucketItems[0].name).toBe(`private/${owner}`);
});
