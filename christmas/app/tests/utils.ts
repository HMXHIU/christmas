import { createUser } from "$lib/community";
import { COUNTRY_DETAILS } from "$lib/userDeviceClient/defs";
import { stringToUint8Array } from "$lib/utils";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { createSignInMessage } from "@solana/wallet-standard-util";
import { Keypair } from "@solana/web3.js";
import fs from "fs";
import path from "path";
import nacl from "tweetnacl";

export {
    createRandomUser,
    getCookiesFromResponse,
    getRandomDate,
    getRandomRegion,
    login,
    readImageAsBuffer,
};

function getCookiesFromResponse(response: Response): string {
    let cookies: string[] = [];

    response.headers.forEach((value, name) => {
        console.log(name, value);
        if (name.toLowerCase() === "set-cookie") {
            cookies.push(...value.split(",")); // multiple set-cookie headers
        }
    });

    return cookies.join("; ");
}

function readImageAsBuffer(imagePath: string): Buffer {
    const absolutePath = path.resolve(__dirname, imagePath);
    return fs.readFileSync(absolutePath);
}

function getRandomDate(startYear: number, endYear: number): Date {
    const year =
        Math.floor(Math.random() * (endYear - startYear + 1)) + startYear;
    const month = Math.floor(Math.random() * 12);
    const day = Math.floor(Math.random() * 28) + 1; // To ensure valid date for all months
    return new Date(Date.UTC(year, month, day));
}

function getRandomRegion(): number[] {
    const regionIdx = Math.floor(
        Math.random() * Object.values(COUNTRY_DETAILS).length,
    );
    const regionCode = Object.values(COUNTRY_DETAILS)[regionIdx][0];
    return Array.from(stringToUint8Array(regionCode));
}

/**
 * Login without a browser, without SIWS (required for tests)
 */
async function login(user: Keypair): Promise<Response> {
    const solanaSignInInput = await (
        await fetch("http://localhost:5173/api/auth/siws")
    ).json();
    const signInMessage = createSignInMessage(solanaSignInInput);
    const solanaSignInOutput = {
        address: user.publicKey.toBase58(),
        signature: Buffer.from(
            nacl.sign.detached(signInMessage, user.secretKey),
        ),
        signedMessage: Buffer.from(signInMessage),
    };
    return await fetch("http://localhost:5173/api/auth/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            solanaSignInInput,
            solanaSignInOutput,
        }),
    });
}

async function createRandomUser({
    region,
}: {
    region: string;
}): Promise<[NodeWallet, string]> {
    const user = Keypair.generate();
    const wallet = new NodeWallet(user);

    let response = await login(user);
    const cookies = getCookiesFromResponse(response);

    // Create User Account
    await createUser(
        { region },
        {
            headers: { Cookie: cookies },
            wallet,
        },
    );

    return [wallet, cookies];
}
