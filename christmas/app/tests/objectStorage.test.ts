import { Keypair } from "@solana/web3.js";

import { ObjectStorage } from "$lib/server/objectStorage";
import { expect, test } from "vitest";

test("Test Public Object Storage", async () => {
    const publicData = {
        name: "tile1",
    };

    // Test create public object
    await ObjectStorage.putObject({
        owner: null,
        bucket: "user",
        name: "tile1",
        data: publicData,
    });

    // Test public object exists
    await expect(
        ObjectStorage.objectExists({
            owner: null,
            bucket: "user",
            name: "tile1",
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

    const privateData = {
        publicKey: keypair.publicKey.toBase58(),
    };

    // Test create private object
    await ObjectStorage.putObject({
        owner: keypair.publicKey.toBase58(),
        bucket: "user",
        name: keypair.publicKey.toBase58(),
        data: privateData,
    });

    // Test private object exists
    await expect(
        ObjectStorage.objectExists({
            owner: keypair.publicKey.toBase58(),
            bucket: "user",
            name: keypair.publicKey.toBase58(),
        }),
    ).resolves.toBe(true);

    await expect(
        ObjectStorage.objectExists({
            owner: null,
            bucket: "user",
            name: keypair.publicKey.toBase58(),
        }),
    ).resolves.toBe(false);

    await expect(
        ObjectStorage.objectExists({
            owner: "doesnotexists",
            bucket: "user",
            name: keypair.publicKey.toBase58(),
        }),
    ).rejects.toThrowError();
});
