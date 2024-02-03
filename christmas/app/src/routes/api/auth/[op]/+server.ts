import { JWT_EXPIRES_IN } from "$env/static/private";
import { signJWT } from "$lib/server/index.js";
import { json } from "@sveltejs/kit";
import type { UserSession } from "../../../../app";
import nacl from "tweetnacl";

export async function POST({ request, params, cookies, locals }) {
    const { op } = params;

    // Login (api/auth/login)
    if (op === "login") {
        // Verify solana signed message
        const { publicKey, signature, message } = await request.json();
        const isVerified = nacl.sign.detached.verify(
            message,
            signature,
            publicKey,
        );

        // TODO: Verify message using nonce

        // Authorized
        if (isVerified) {
            const userSession: UserSession = {
                publicKey: "asd",
            };

            const token = await signJWT(userSession);

            cookies.set("token", token, {
                path: "/",
                httpOnly: true,
                secure: true,
                sameSite: "strict",
                maxAge: parseInt(JWT_EXPIRES_IN) * 60,
            });

            return json({ status: "success", token });
        }
        // Unauthorized
        else {
            locals.user = null;
            cookies.delete("token", {
                path: "/",
            });
            return json(
                { status: "error", message: "Unauthorized" },
                { status: 401 },
            );
        }
    }
    // Logout (api/auth/logout)
    else if (op === "logout") {
        locals.user = null;
        cookies.delete("token", {
            path: "/",
        });
        return json({ status: "success" });
    }
}

export async function GET({ params, locals }) {
    const { op } = params;

    // User (api/auth/user)
    if (op === "user") {
        const user = locals.user;
        try {
            if (!user) {
                return json(
                    {
                        message: "You are not logged in",
                    },
                    { status: 401 },
                );
            }
            return json({ ...user });
        } catch (error: any) {
            return json({ message: error.message }, { status: 500 });
        }
    }
}
