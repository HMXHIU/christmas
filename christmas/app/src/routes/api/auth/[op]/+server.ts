import { JWT_EXPIRES_IN } from "$env/static/private";
import {
    createSignInDataForSIWS,
    signJWT,
    verifySIWS,
} from "$lib/server/index.js";
import { json } from "@sveltejs/kit";

export async function POST({ request, params, cookies, locals }) {
    const { op } = params;

    // Login (api/auth/login)
    if (op === "login") {
        // Verify solana signed message

        let { solanaSignInInput, solanaSignInOutput } = await request.json();
        const isVerified = verifySIWS(solanaSignInInput, solanaSignInOutput);

        // Authorized
        if (isVerified) {
            const userSession: App.UserSession = {
                publicKey: solanaSignInOutput.address,
            };

            const token = await signJWT(userSession);

            cookies.set("token", token, {
                path: "/",
                httpOnly: true,
                secure: true,
                sameSite: "strict",
                maxAge: parseInt(JWT_EXPIRES_IN), // in seconds
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

    // Sign In With Solana - get signInData (api/auth/siws)
    if (op === "siws") {
        return json(await createSignInDataForSIWS());
    }
}
