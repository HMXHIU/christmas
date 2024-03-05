import { createUser, fetchUser, fetchUserMetadata } from "$lib/community";
import {
    login as loginCrossover,
    logout as logoutCrossover,
    signup,
} from "$lib/crossover";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { Keypair } from "@solana/web3.js";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { expect, test } from "vitest";
import { getCookiesFromResponse, getRandomRegion, login } from "../utils";

test("Test Auth", async () => {
    const user = Keypair.generate();
    const userWallet = new NodeWallet(user);
    const name: string = "Gandalf";
    const region = getRandomRegion();

    // Login
    let response = await login(user);
    const loginResult = (await response.json()).result.data;
    const cookies = getCookiesFromResponse(response);

    expect(
        (
            jwt.decode(loginResult.token, { complete: true })
                ?.payload as JwtPayload
        ).publicKey,
    ).toEqual(user.publicKey.toBase58());
    expect(loginResult.status).toBe("success");

    // Login Crossover (Can't login withou user account)
    await expect(loginCrossover({ Cookie: cookies })).rejects.toThrow(
        `User account ${user.publicKey.toBase58()} does not exist`,
    );

    // Signup Crossover (Can't login withou user account)
    await expect(
        signup({ name }, { headers: { Cookie: cookies }, wallet: userWallet }),
    ).rejects.toThrow(
        `User account ${user.publicKey.toBase58()} does not exist`,
    );

    // Create User Account
    let tx = await createUser(
        { region: String.fromCharCode(...region) },
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

    // Fetch user & metadata
    const userAcount = await fetchUser({ Cookie: cookies });
    expect(userAcount).toMatchObject({
        region: region,
    });
    const userMetadata = await fetchUserMetadata(userAcount!, {
        Cookie: cookies,
    });
    expect(userMetadata).toMatchObject({
        publicKey: user.publicKey.toBase58(),
        crossover: {
            player: user.publicKey.toBase58(),
            name: "Gandalf",
        },
    });

    // Login Crossover
    await expect(loginCrossover({ Cookie: cookies })).resolves.toEqual({
        status: "success",
        player: {
            player: user.publicKey.toBase58(),
            name: name,
            loggedIn: true,
        },
    });

    // Check player loaded in repository
    await expect(logoutCrossover({ Cookie: cookies })).resolves.toEqual({
        status: "success",
        player: {
            player: user.publicKey.toBase58(),
            name: name,
            loggedIn: false,
        },
    });
});
