import { JWT_EXPIRES_IN } from "$env/static/private";
import { signJWT, verifyJWT } from "$lib/server/index.js";
import { json } from "@sveltejs/kit";

export async function POST({ request, params, cookies, locals }) {
    const { op } = params;

    // Login (api/auth/login)
    if (op === "login") {
        // Verify solana signed message
        const pubKey = "asd";
        const isVerified = true;

        // Authorized
        if (isVerified) {
            const token = await signJWT({ pubKey });
            const tokenMaxAge = parseInt(JWT_EXPIRES_IN) * 60;

            cookies.set("token", token, {
                path: "/",
                httpOnly: true,
                secure: true,
                sameSite: "strict",
                maxAge: tokenMaxAge,
            });

            return json({ status: "success", token, pubKey });
        }
        // Unauthorized
        else {
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
