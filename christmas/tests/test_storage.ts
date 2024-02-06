import { NFTMinioClient } from "../app/src/lib/clients/nft-client/nftMinioClient";

import { ObjectStorage } from "../app/src/lib/server/objectStorage";
import { Keypair } from "@solana/web3.js";

import chai from "chai";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
import { assert, expect } from "chai";

describe("Test Storage", () => {
    it("Test NFT Storage", async () => {
        // requires local minio server to be up (see docker-compose.yml)
    });

    it("Test Object Storage", async () => {
        const keypair = Keypair.generate();

        const privateData = {
            publicKey: keypair.publicKey.toBase58(),
        };

        const publicData = {
            name: "tile1",
        };

        // Test create private object
        await ObjectStorage.putObject({
            owner: keypair.publicKey.toBase58(),
            bucket: "user",
            name: keypair.publicKey.toBase58(),
            data: privateData,
        });

        // Test private object exists
        expect(
            ObjectStorage.objectExists({
                owner: keypair.publicKey.toBase58(),
                bucket: "user",
                name: keypair.publicKey.toBase58(),
            })
        ).to.be.true;

        expect(
            ObjectStorage.objectExists({
                owner: null,
                bucket: "user",
                name: keypair.publicKey.toBase58(),
            })
        ).to.be.false;

        expect(
            ObjectStorage.objectExists({
                owner: "doesnotexists",
                bucket: "user",
                name: keypair.publicKey.toBase58(),
            })
        ).to.throw(Error);

        // Test create public object
        await ObjectStorage.putObject({
            owner: null,
            bucket: "user",
            name: "tile1",
            data: publicData,
        });

        // Test public object exists
        expect(
            ObjectStorage.objectExists({
                owner: null,
                bucket: "user",
                name: "tile1",
            })
        ).to.be.true;

        expect(
            ObjectStorage.objectExists({
                owner: "doesnotexists",
                bucket: "user",
                name: "tile1",
            })
        ).to.throw(Error);

        expect(
            ObjectStorage.objectExists({
                owner: null,
                bucket: "user",
                name: "notile",
            })
        ).to.be.false;
    });
});
