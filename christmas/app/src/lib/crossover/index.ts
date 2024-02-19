import { PUBLIC_HOST } from "$env/static/public";
import type { TransactionResult } from "$lib/anchorClient/types";
import { signAndSendTransaction } from "$lib/utils";
import { Transaction } from "@solana/web3.js";

export { signup, login, logout };

/**
 * All auth functions requires user to be logged in already via SIWS (use cookies in headers to login without a browser).
 * Override the host if you are testing from a different environment.
 */

async function signup(
    { name }: { name: string },
    options?: { headers?: HeadersInit; wallet?: any },
): Promise<TransactionResult> {
    return await fetch(`${PUBLIC_HOST || ""}/api/crossover/auth/signup`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(options?.headers || {}),
        },
        body: JSON.stringify({ name }),
    })
        .then(async (response) => {
            if (!response.ok) {
                throw new Error(await response.text());
            }
            return response.json();
        })
        .then(({ transaction }) => {
            console.log("transaction", transaction);

            return signAndSendTransaction({
                tx: Transaction.from(Buffer.from(transaction, "base64")),
                wallet: options?.wallet,
                commitment: "confirmed",
            });
        });
}

async function login(headers: any = {}): Promise<Response> {
    return await fetch(`${PUBLIC_HOST}/api/crossover/auth/login`, {
        method: "POST",
        headers,
    }).then(async (response) => {
        if (!response.ok) {
            throw new Error(await response.text());
        }
        return response.json();
    });
}

async function logout(headers: any = {}): Promise<Response> {
    return await fetch(`${PUBLIC_HOST}/api/crossover/auth/logout`, {
        method: "POST",
        headers,
    }).then(async (response) => {
        if (!response.ok) {
            throw new Error(await response.text());
        }
        return response.json();
    });
}
