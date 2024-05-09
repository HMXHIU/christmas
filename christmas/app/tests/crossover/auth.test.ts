import { createUser, fetchUser, fetchUserMetadata } from "$lib/community";
import {
    login as loginCrossover,
    logout as logoutCrossover,
    signup,
} from "$lib/crossover";
import { worldSeed } from "$lib/crossover/world/settings";
import { ObjectStorage } from "$lib/server/objectStorage";
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
    const geohash = "gbsuv7";

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
    await expect(
        loginCrossover({ geohash, region }, { Cookie: cookies }),
    ).rejects.toThrow(
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
    var { status, player } = await loginCrossover(
        { region, geohash },
        { Cookie: cookies },
    );
    expect(status).toBe("success");
    expect(player).toMatchObject({
        player: user.publicKey.toBase58(),
        name: name,
        loggedIn: true,
        ap: 4,
        hp: 10,
        level: 1,
        mp: 10,
        st: 10,
        buffs: [],
        debuffs: [],
    });
    expect(player.location[0].length).toBe(worldSeed.spatial.unit.precision); // test auto correct geohash precision
    expect(player.location[0].startsWith(geohash)).toBe(true); // should be contained in the user's geohash

    // Check player state
    await expect(
        ObjectStorage.getJSONObject({
            owner: user.publicKey.toBase58(),
            bucket: "player",
            name: user.publicKey.toBase58(),
        }),
    ).resolves.toMatchObject({
        loggedIn: true,
        location: player.location,
        locT: "geohash",
        ap: 4,
        hp: 10,
        level: 1,
        mp: 10,
        st: 10,
        buffs: [],
        debuffs: [],
    });

    // Logout Crossover
    await expect(logoutCrossover({ Cookie: cookies })).resolves.toEqual({
        status: "success",
        player: {
            player: user.publicKey.toBase58(),
            name: name,
            loggedIn: false,
            location: player.location,
            locT: "geohash",
            ap: 4,
            hp: 10,
            level: 1,
            mp: 10,
            st: 10,
            buffs: [],
            debuffs: [],
        },
    });

    // Check player state
    await expect(
        ObjectStorage.getJSONObject({
            owner: user.publicKey.toBase58(),
            bucket: "player",
            name: user.publicKey.toBase58(),
        }),
    ).resolves.toMatchObject({
        loggedIn: false,
        location: player.location,
        locT: "geohash",
        ap: 4,
        hp: 10,
        level: 1,
        mp: 10,
        st: 10,
        buffs: [],
        debuffs: [],
    });
});
