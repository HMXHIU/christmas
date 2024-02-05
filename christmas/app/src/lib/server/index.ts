import jwt, { type JwtPayload } from "jsonwebtoken";
import type {
    SolanaSignInInput,
    SolanaSignInOutput,
} from "@solana/wallet-standard-features";
import { verifySignIn } from "@solana/wallet-standard-util";

import {
    JWT_SECRET_KEY,
    JWT_EXPIRES_IN,
    ENVIRONMENT,
} from "$env/static/private";
import { PUBLIC_HOST } from "$env/static/public";
import base58 from "bs58";

export async function signJWT(payload: object): Promise<string> {
    return new Promise((resolve, reject) => {
        jwt.sign(
            payload,
            JWT_SECRET_KEY,
            {
                expiresIn: parseInt(JWT_EXPIRES_IN),
            },
            (err, token) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(token!);
                }
            },
        );
    });
}

export function verifyJWT(token: string): Promise<string | JwtPayload> {
    return new Promise((resolve, reject) => {
        jwt.verify(token, JWT_SECRET_KEY, (err, decoded) => {
            if (err) {
                reject(err);
            } else {
                resolve(decoded!);
            }
        });
    });
}

export const createSignInDataForSIWS = async (): Promise<SolanaSignInInput> => {
    const now: Date = new Date();
    const currentUrl = new URL(PUBLIC_HOST);
    const domain = currentUrl.host;
    const currentDateTime = now.toISOString();

    let chainId = "localnet";
    if (ENVIRONMENT === "production") {
        chainId = "mainnet";
    } else if (ENVIRONMENT === "staging") {
        chainId = "devnet";
    }

    const signInData: SolanaSignInInput = {
        domain,
        statement:
            "Clicking Sign or Approve only means you have proved this wallet is owned by you. This request will not trigger any blockchain transaction or cost any gas fee.",
        version: "1",
        nonce: "oBbLoEldZs",
        issuedAt: currentDateTime,
        resources: ["https://example.com", "https://phantom.app/"],
        chainId,
    };

    return signInData;
};

export function verifySIWS(input: SolanaSignInInput, output: any): boolean {
    // Get chains based on environment
    let chains: `${string}:${string}`[] = ["solana:localnet"];
    if (ENVIRONMENT === "production") {
        chains = ["solana:mainnet"];
    } else if (ENVIRONMENT === "staging") {
        chains = ["solana:devnet"];
    }
    // Deserialize output
    const serialisedOutput: SolanaSignInOutput = {
        // Patch for missing account in solanaSignInOutput
        account: {
            address: output.address,
            publicKey: base58.decode(output.address),
            chains: chains,
            features: ["solana:signIn"],
        },
        signature: new Uint8Array(output.signature.data),
        signedMessage: new Uint8Array(output.signedMessage.data),
    };
    return verifySignIn(input, serialisedOutput);
}
