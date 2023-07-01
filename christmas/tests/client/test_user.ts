import { assert, expect } from "chai";
import AnchorClient from "../../app/src/lib/anchorClient";
import { sha256 } from "js-sha256";

import { stringToUint8Array } from "../../app/src/lib/utils";

describe("Test user", () => {
    const client = new AnchorClient();

    it("Airdrop", async () => {
        // get some sol to perform tx
        const sig = await client.requestAirdrop(100e9);
        console.log(`Airdrop: ${sig}`);
    });

    it("Get user PDA", async () => {
        const [pda, bump] = client.getUserPda();
        assert(pda);
        console.log(`pda: ${pda}, bump: ${bump}`);
    });

    it("Create user", async () => {
        const email = "christmas@gmail.com";
        const geo = "gbsuv7";
        const region = "SGP";

        await client.createUser({ email, geo, region });

        const [pda, _] = client.getUserPda();
        const user = await client.program.account.user.fetch(pda);

        assert.ok(user.geo == geo);
        assert.ok(user.region == region);
        const twoFactor = sha256.digest([
            ...client.wallet.publicKey.toBytes(),
            ...stringToUint8Array(email),
        ]);
        expect(twoFactor).to.deep.equal(user.twoFactor);
    });
});
