import { expect } from "chai";
import { getRandomRegion, getRandomAnchorClient } from "./utils";

describe("Test User", () => {
    const [userKeypair, anchorClient] = getRandomAnchorClient();
    const region = getRandomRegion();

    it("Test User", async () => {
        const tx = await anchorClient.createUser({
            region,
            uri: "",
        });

        expect(tx.result.err).to.be.null;
    });
});
