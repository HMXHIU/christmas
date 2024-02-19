import { expect } from "chai";
import {
    getRandomRegion,
    getRandomAnchorClient,
    requestAirdrop,
} from "./utils";

describe("Test User", () => {
    const [userKeypair, anchorClient] = getRandomAnchorClient();
    const region = getRandomRegion();

    it("Test User", async () => {
        await requestAirdrop(
            [userKeypair.publicKey],
            10e9,
            anchorClient.connection
        );

        const tx = await anchorClient.createUser({
            region,
            uri: "",
        });

        expect(tx.result.err).to.be.null;
    });
});
