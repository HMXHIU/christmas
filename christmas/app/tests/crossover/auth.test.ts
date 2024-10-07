import { createMember, fetchUser } from "$lib/community";
import {
    crossoverAvailableAvatars,
    crossoverPlayerMetadata,
    login as loginCrossover,
    signup,
} from "$lib/crossover/client";
import { type PlayerMetadata } from "$lib/crossover/world/player";
import { worldSeed } from "$lib/crossover/world/settings/world";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { Keypair } from "@solana/web3.js";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { beforeAll, expect, test } from "vitest";
import { getCookiesFromResponse, getRandomRegion, login } from "../utils";

const user = Keypair.generate();
const userWallet = new NodeWallet(user);
const name: string = "Gandalf";
const region = String.fromCharCode(...getRandomRegion());
const geohash = "gbsuv7";
let playerMetadata: PlayerMetadata = {
    player: user.publicKey.toBase58(),
    name,
    description: "A powerful wizard",
    avatar: "", // Invalid till chosen
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
let playerCookies: string;

beforeAll(async () => {
    // Test Can Login (SIWS) - Does not need User Account at this point
    let response = await login(user);
    const loginResult = (await response.json()).result.data;
    playerCookies = getCookiesFromResponse(response);
    expect(
        (
            jwt.decode(loginResult.token, { complete: true })
                ?.payload as JwtPayload
        ).publicKey,
    ).toEqual(user.publicKey.toBase58());
    expect(loginResult.status).toBe("success");

    // Login Crossover (Can't login without user account)
    await expect(
        loginCrossover({ geohash, region }, { Cookie: playerCookies }),
    ).rejects.toThrow(`User ${user.publicKey.toBase58()} does not exist`);

    // Signup Crossover (Can't signup without avatar)
    playerMetadata.avatar = "http://example.com";
    await expect(
        signup(playerMetadata, {
            headers: { Cookie: playerCookies },
            wallet: userWallet,
        }),
    ).rejects.toThrow(`Avatar for ${user.publicKey.toBase58()} does not exist`);
    playerMetadata.avatar = ""; // revert to make it invalid for tests below

    // Create User Account
    let member = await createMember(
        { region },
        {
            headers: { Cookie: playerCookies },
        },
    );
    expect(member).toMatchObject({ region });
});

test("Test `crossoverAvailableAvatars`", async () => {
    const avatars = await crossoverAvailableAvatars(
        {
            demographic: playerMetadata.demographic,
            appearance: playerMetadata.appearance,
        },
        { Cookie: playerCookies },
    );
    expect(avatars.length).greaterThan(0);
});

test("Test Crossover AuthZ", async () => {
    const avatars = await crossoverAvailableAvatars(
        {
            demographic: playerMetadata.demographic,
            appearance: playerMetadata.appearance,
        },
        { Cookie: playerCookies },
    );

    // Signup Crossover (can't sign up with invalid avatar)
    await expect(
        signup(playerMetadata, {
            headers: { Cookie: playerCookies },
            wallet: userWallet,
        }),
    ).rejects.toThrowError();

    // Choose Avatar
    playerMetadata.avatar = avatars[0];

    // Signup Crossover
    playerMetadata = await signup(playerMetadata, {
        headers: { Cookie: playerCookies },
        wallet: userWallet,
    });
    expect(playerMetadata).toMatchObject(playerMetadata);

    // Check User Account (Community)
    const userAcount = await fetchUser({ Cookie: playerCookies });
    expect(userAcount.community).toMatchObject({
        region: region,
    });

    // Check PlayerMetadata (Crossover & Community)
    const userMetadata = await crossoverPlayerMetadata({
        Cookie: playerCookies,
    });
    expect(userMetadata).toMatchObject({
        publicKey: user.publicKey.toBase58(),
        crossover: playerMetadata,
    });

    // Login Crossover
    var player = await loginCrossover(
        { region, geohash },
        { Cookie: playerCookies },
    );

    // Check player initial state
    expect(player).toMatchObject({
        player: user.publicKey.toBase58(),
        name: "Gandalf",
        avatar: playerMetadata.avatar,
        lgn: true,
        rgn: region,
        locT: "geohash",
        locI: "@",
        hp: 11,
        mnd: 1,
        cha: 1,
        lum: 0,
        umb: 0,
        buclk: 0,
        dbuf: [],
        buf: [],
        arch: playerMetadata.demographic.archetype,
        gen: playerMetadata.demographic.gender,
        race: playerMetadata.demographic.race,
        skills: {},
        pthclk: 0,
        pthdur: 0,
        pth: [],
        pthst: "",
    });
    expect(player.loc[0].length).toBe(worldSeed.spatial.unit.precision); // test auto correct geohash precision
    expect(player.loc[0].startsWith(geohash)).toBe(true); // should be contained in the user's geohash
});
