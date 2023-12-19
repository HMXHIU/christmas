// import { assert, expect } from "chai";
// import AnchorClient from "../../app/src/lib/anchorClient";
// import { cleanString } from "../../app/src/lib/utils";

// describe("Test user", () => {
//     const client = new AnchorClient();

//     it("Airdrop", async () => {
//         // get some sol to perform tx
//         const sig = await client.requestAirdrop(100e9);
//         console.log(`Airdrop: ${sig}`);
//     });

//     it("Get user PDA", async () => {
//         const [pda, bump] = client.getUserPda();
//         assert(pda);
//     });

//     it("Create user", async () => {
//         // test getUser() before creating
//         const nonExistentUser = await client.getUser();
//         assert.equal(nonExistentUser, null);

//         const geo = "gbsuv7";
//         const region = "SGP";

//         await client.createUser({ geo, region });

//         // test getUser() after creating
//         const validUser = await client.getUser();
//         assert.equal(cleanString(validUser.geo), geo);
//         assert.equal(cleanString(validUser.region), region);

//         const [pda, _] = client.getUserPda();
//         const user = await client.program.account.user.fetch(pda);

//         assert.ok(user.geo == geo);
//         assert.ok(user.region == region);
//     });
// });
