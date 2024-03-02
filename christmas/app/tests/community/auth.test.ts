import { trpc } from "$lib/trpcClient";
import { Keypair } from "@solana/web3.js";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { expect, test } from "vitest";
import { getCookiesFromResponse, login } from "../utils";

test("Test Auth", async () => {
    const user = Keypair.generate();

    // Login
    let response = await login(user);
    var { status, token } = (await response.json()).result.data as {
        status: string;
        token: string;
    };
    const cookies = getCookiesFromResponse(response);
    expect(
        (jwt.decode(token, { complete: true })?.payload as JwtPayload)
            .publicKey,
    ).toEqual(user.publicKey.toBase58());
    expect(status).toBe("success");

    // Refresh
    var { status, token } = await trpc({
        headers: {
            Cookie: cookies,
        },
    }).community.auth.refresh.query();
    expect(
        (jwt.decode(token, { complete: true })?.payload as JwtPayload)
            .publicKey,
    ).toEqual(user.publicKey.toBase58());
    expect(status).toBe("success");

    // User
    var { publicKey } = await trpc({
        headers: {
            Cookie: cookies,
        },
    }).community.auth.user.query();
    expect(publicKey).toEqual(user.publicKey.toBase58());

    // Logout
    var { status } = await trpc({
        headers: {
            Cookie: cookies,
        },
    }).community.auth.logout.query();
    expect(status).toBe("success");
});
