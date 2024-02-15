import { PUBLIC_HOST } from "$env/static/public";
import { Transaction } from "@solana/web3.js";

export { signUp };

/**
 * Requires user to be logged in already via SIWS (use cookies in headers to login without a browser).
 * Override the host if you are testing from a different environment.
 *
 * Returns a transaction for user to sign.
 */
async function signUp(
    { name }: { name: string },
    headers: any = {},
): Promise<Transaction> {
    const signUpResult = await fetch(
        `${PUBLIC_HOST || ""}/api/crossover/auth/signup`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...headers,
            },
            body: JSON.stringify({ name }),
        },
    );

    const response = await signUpResult.json();

    if (!signUpResult.ok) {
        throw new Error(response.message);
    }

    return Transaction.from(Buffer.from(response.transaction, "base64"));
}
