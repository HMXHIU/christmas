import { PUBLIC_ENVIRONMENT, PUBLIC_HOST } from "$env/static/public";
import { stringToUint8Array } from "$lib/utils";
import type {
    SolanaSignInInput,
    SolanaSignInOutput,
} from "@solana/wallet-standard-features";
import { verifySignIn } from "@solana/wallet-standard-util";
import { error, type RequestEvent } from "@sveltejs/kit";
import base58 from "bs58";
import jwt, { type JwtPayload } from "jsonwebtoken";
import tweetnacl from "tweetnacl";

// Exports
export {
    createSignInDataForSIWS,
    generateNonce,
    hashObject,
    requireLogin,
    signJWT,
    verifyJWT,
    verifySIWS,
};

async function signJWT(
    payload: object,
    expiresIn: number,
    key: string,
): Promise<string> {
    return new Promise((resolve, reject) => {
        jwt.sign(payload, key, { expiresIn }, (err, token) => {
            if (err) {
                reject(err);
            } else {
                resolve(token!);
            }
        });
    });
}

async function verifyJWT(
    token: string,
    key: string,
): Promise<string | JwtPayload> {
    return new Promise((resolve, reject) => {
        jwt.verify(token, key, (err, decoded) => {
            if (err) {
                reject(err);
            } else {
                resolve(decoded!);
            }
        });
    });
}

function generateNonce(length: number = 8): string {
    const nonceBytes = tweetnacl.randomBytes(length);
    return base58.encode(nonceBytes);
}

async function createSignInDataForSIWS(): Promise<SolanaSignInInput> {
    const now: Date = new Date();
    const currentUrl = new URL(PUBLIC_HOST);
    const domain = currentUrl.host;
    const currentDateTime = now.toISOString();

    let chainId = "localnet";
    if (PUBLIC_ENVIRONMENT === "production") {
        chainId = "mainnet";
    } else if (PUBLIC_ENVIRONMENT === "staging") {
        chainId = "devnet";
    }

    // generate random nonce (min 8 chars) TODO: Who checks the nonce????
    const nonce = generateNonce();

    const signInData: SolanaSignInInput = {
        domain,
        statement:
            "Clicking Sign or Approve only means you have proved this wallet is owned by you. This request will not trigger any blockchain transaction or cost any gas fee.",
        version: "1",
        nonce: nonce,
        issuedAt: currentDateTime,
        resources: ["https://phantom.app/"],
        chainId,
    };

    return signInData;
}

function verifySIWS(input: SolanaSignInInput, output: any): boolean {
    // Get chains based on environment
    let chains: `${string}:${string}`[] = ["solana:localnet"];
    if (PUBLIC_ENVIRONMENT === "production") {
        chains = ["solana:mainnet"];
    } else if (PUBLIC_ENVIRONMENT === "staging") {
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

function requireLogin(request: RequestEvent): App.UserSession {
    if (!request.locals.user) {
        error(401, "Unauthorized");
    }
    return request.locals.user;
}

function hashObject(
    obj: any,
    algorithm: "sha256" | "sha512" | "md5" = "sha256",
): string {
    const str = sortedStringify(obj);
    let hashedArray = tweetnacl.hash(stringToUint8Array(str)); // tweetnacl uses sha512
    if (algorithm === "sha256") {
        hashedArray = hashedArray.subarray(0, 32);
    } else if (algorithm == "md5") {
        hashedArray = hashedArray.subarray(0, 16);
    }
    return Array.from(hashedArray)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

function sortedStringify(obj: any): string {
    if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
        return JSON.stringify(obj);
    }
    const keys = Object.keys(obj).sort();
    const sortedObj = keys
        .map((key) => `${JSON.stringify(key)}:${sortedStringify(obj[key])}`)
        .join(",");
    return `{${sortedObj}}`;
}
