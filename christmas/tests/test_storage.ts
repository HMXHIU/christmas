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
});
