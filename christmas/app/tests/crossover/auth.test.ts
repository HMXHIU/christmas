import { createUser, fetchUser } from "$lib/community";
import {
    crossoverPlayerMetadata,
    login as loginCrossover,
    logout as logoutCrossover,
    signup,
} from "$lib/crossover/client";
import { type PlayerMetadata } from "$lib/crossover/world/player";
import { worldSeed } from "$lib/crossover/world/settings/world";
import { generateAvatarHash } from "$lib/server/crossover/player";
import { ObjectStorage } from "$lib/server/objectStorage";
import { generateRandomSeed } from "$lib/utils";
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
    const playerMetadata: PlayerMetadata = {
        player: user.publicKey.toBase58(),
        name,
        description: "A powerful wizard",
        avatar: "",
        demographic: {
            gender: "male",
            race: "human",
            archetype: "believer",
        },
        appearance: {
            hair: {
                type: "afro",
                color: "ash_blonde",
            },
            eye: {
                type: "almond",
                color: "amber",
            },
            face: "angular",
            body: "athletic",
            skin: "alabaster",
            personality: "adventurous",
            age: "adult",
        },
    };

    const avatarHash = generateAvatarHash({
        demographic: playerMetadata.demographic,
        appearance: playerMetadata.appearance,
        textures: {},
    });

    const avatarFilename = `${avatarHash}-${generateRandomSeed()}.png`;
    playerMetadata.avatar = `https://example.com/avatar/${avatarFilename}`;
    await ObjectStorage.putObject({
        owner: null,
        bucket: "avatar",
        name: avatarFilename,
        data: Buffer.from(""),
    });

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

    // Signup Crossover (Can't login without user account)
    await expect(
        signup(playerMetadata, {
            headers: { Cookie: cookies },
            wallet: userWallet,
        }),
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
    tx = await signup(playerMetadata, {
        headers: { Cookie: cookies },
        wallet: userWallet,
    });
    expect(tx.result.err).toBe(null);

    // Fetch user & metadata
    const userAcount = await fetchUser({ Cookie: cookies });
    expect(userAcount).toMatchObject({
        region: region,
    });

    const userMetadata = await crossoverPlayerMetadata({
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
        lgn: true,
        ap: 4,
        hp: 10,
        lvl: 1,
        mp: 10,
        st: 10,
        buf: [],
        dbuf: [],
        lum: 0,
        umb: 0,
    });
    expect(player.loc[0].length).toBe(worldSeed.spatial.unit.precision); // test auto correct geohash precision
    expect(player.loc[0].startsWith(geohash)).toBe(true); // should be contained in the user's geohash

    // Check player state
    await expect(
        ObjectStorage.getJSONObject({
            owner: user.publicKey.toBase58(),
            bucket: "player",
            name: user.publicKey.toBase58(),
        }),
    ).resolves.toMatchObject({
        lgn: true,
        loc: player.loc,
        locT: "geohash",
        ap: 4,
        hp: 10,
        lvl: 1,
        mp: 10,
        st: 10,
        buf: [],
        dbuf: [],
        lum: 0,
        umb: 0,
    });

    // Logout Crossover
    await expect(logoutCrossover({ Cookie: cookies })).resolves.toMatchObject({
        status: "success",
        player: {
            player: user.publicKey.toBase58(),
            name: name,
            lgn: false,
            loc: player.loc,
            locT: "geohash",
            ap: 4,
            hp: 10,
            lvl: 1,
            mp: 10,
            st: 10,
            buf: [],
            dbuf: [],
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
        lgn: false,
        loc: player.loc,
        locT: "geohash",
        ap: 4,
        hp: 10,
        lvl: 1,
        mp: 10,
        st: 10,
        buf: [],
        dbuf: [],
    });
});
