import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Christmas } from "../target/types/christmas";
import { web3 } from "@coral-xyz/anchor";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { createUser, requestAirdrop } from "./utils";
import {
    USER_ACCOUNT_SIZE,
    TWO_FACTOR_SIZE,
    REGION_SIZE,
    DISCRIMINATOR_SIZE,
    STRING_PREFIX_SIZE,
} from "../lib/anchor-client/constants";

describe("Test Geo", () => {
    // Configure the client to use the local cluster.
    anchor.setProvider(anchor.AnchorProvider.env());
    const provider = anchor.getProvider();
    const program = anchor.workspace.Christmas as Program<Christmas>;

    it("Get users within radius", async () => {
        // Create some users around singapore
        // prettier-ignore
        let hashesAroundSingapore = [
            "w21z3w", "w21ze8", "w21zgh", "w21zem", "w21zd5", "w21z9c", "w21zg8", "w21ze0",
            "w21z7r", "w21z9f", "w21zf4", "w21z9b", "w21z6x", "w21zdt", "w21ze7", "w21zgs",
            "w21zd0", "w21ze2", "w21zcc", "w21zcg", "w21zg1", "w21zfd", "w21zg4", "w21zex",
            "w21zf7", "w21zen", "w21zd6", "w21zfn", "w21zfk", "w21zc8", "w21zgn", "w21zd2",
            "w21zet", "w21zfq", "w21z9z", "w21ze4", "w21zgw", "w21zed", "w21z98", "w21zfg",
            "w21zfw", "w21zg2", "w21zdh", "w21zcb", "w21ze9", "w21zf6", "w21z7n", "w21zeh",
            "w21zdw", "w21zcy", "w21z9d", "w21zdc", "w21zf2", "w21zdu", "w21zdz", "w21zf9",
            "w21z9y", "w21zdk", "w21zdq", "w21zgk", "w21zg5", "w21zgq", "w21z9w", "w21ze6",
            "w21zcq", "w21zfv", "w21zf8", "w21z9g", "w21z9t", "w21zfu", "w21z7p", "w21z7w",
            "w21zgm", "w21zc9", "w21zdj", "w21zdg", "w21zfy", "w21zdm", "w21zgt", "w21z9v",
        ]

        const userLocations = hashesAroundSingapore.map(
            (geo: string): [web3.Keypair, string] => {
                return [anchor.web3.Keypair.generate(), geo];
            }
        );

        // Airdrop users
        await requestAirdrop(
            userLocations.map(([user, _]) => user.publicKey),
            10e9
        );

        // Create users
        const pdas = await Promise.all(
            userLocations.map(([user, geo]) => {
                return new Promise<[web3.PublicKey, number]>(
                    async (resolve) => {
                        const email = `${geo}@gmail.com`;
                        const region = "SGP";
                        const [pda, bump] = await createUser(user, region, geo);
                        resolve([pda, bump]);
                    }
                );
            })
        );

        /*
            TODO:
            1. Write geohash function in JS utils
            2. Get geohashes in radius
            3. Filter accounts for geohashes

            - given geo hash center and radius
            - given the radius, choose an appropriate precision (number of digits) to reduce the search space
            - get all geohashes in scope (up to precision)
            - calculate largest common prefixes (might have more than 1)
            - query memcmp based on largest common prefixes (bits) (get a bunch of users)
            - filter finely the results if they are in the original set
            - this is because we can only retrieve the accounts using memcmp with a bit prefix
        */

        const user_accounts = await program.account.user.all([
            {
                dataSize: USER_ACCOUNT_SIZE,
            },
            {
                memcmp: {
                    offset:
                        DISCRIMINATOR_SIZE + REGION_SIZE + STRING_PREFIX_SIZE,
                    bytes: bs58.encode(Buffer.from("w21zc9", "utf-8")),
                },
            },
        ]);
    });
});
