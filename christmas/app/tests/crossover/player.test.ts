import { createUser } from "$lib/community";
import { login as loginCrossover, signup } from "$lib/crossover";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { Keypair } from "@solana/web3.js";
import { expect, test } from "vitest";
import { getCookiesFromResponse, getRandomRegion, login } from "../utils";

test("Test Player", async () => {
    const user = Keypair.generate();
    const userWallet = new NodeWallet(user);
    const name: string = "Gandalf";
    const region = String.fromCharCode(...getRandomRegion());
    const geohash = "gbsuv7";

    // Login
    let response = await login(user);
    const loginResult = (await response.json()).result.data;
    const cookies = getCookiesFromResponse(response);

    // Create User Account
    let tx = await createUser(
        { region },
        {
            headers: { Cookie: cookies },
            wallet: userWallet,
        },
    );
    expect(tx.result.err).toBe(null);

    // Signup Crossover
    tx = await signup(
        { name },
        { headers: { Cookie: cookies }, wallet: userWallet },
    );
    expect(tx.result.err).toBe(null);

    // Login Crossover
    await expect(
        loginCrossover({ geohash, region }, { Cookie: cookies }),
    ).resolves.toEqual({
        status: "success",
        player: {
            player: user.publicKey.toBase58(),
            name: name,
            loggedIn: true,
            tile: geohash, // tile should be initialized to geohash the first time
        },
    });
});
