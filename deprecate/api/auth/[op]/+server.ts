import { JWT_SECRET_KEY, REFRESH_JWT_SECRET_KEY } from "$env/static/private";
import {
    PUBLIC_JWT_EXPIRES_IN,
    PUBLIC_REFRESH_JWT_EXPIRES_IN,
} from "$env/static/public";
import {
    createSignInDataForSIWS,
    signJWT,
    verifyJWT,
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

            // Set token and refresh token on cookies
            const token = await signJWT(
                userSession,
                parseInt(PUBLIC_JWT_EXPIRES_IN),
                JWT_SECRET_KEY,
            );
            const refreshToken = await signJWT(
                userSession,
                parseInt(PUBLIC_REFRESH_JWT_EXPIRES_IN),
                REFRESH_JWT_SECRET_KEY,
            );
            // TODO: This seems to be setting 2 set-cookies headers
            cookies.set("token", token, {
                path: "/",
                httpOnly: true,
                secure: true,
                sameSite: "strict",
                maxAge: parseInt(PUBLIC_JWT_EXPIRES_IN), // in seconds
            });
            cookies.set("refreshToken", refreshToken, {
                path: "/",
                httpOnly: true,
                secure: true,
                sameSite: "strict",
                maxAge: parseInt(PUBLIC_REFRESH_JWT_EXPIRES_IN), // in seconds
            });

            return json({ status: "success", token });
        }
        // Unauthorized
        else {
            locals.user = null;
            cookies.delete("token", {
                path: "/",
            });
            cookies.delete("refreshToken", {
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
        cookies.delete("refreshToken", {
            path: "/",
        });
        return json({ status: "success" });
    }
    // Refresh (api/auth/refresh)
    else if (op === "refresh") {
        const refreshToken = cookies.get("refreshToken");

        if (!refreshToken) {
            return json(
                {
                    status: "error",
                    message: "Missing refreshToken",
                },
                { status: 401 },
            );
        }
        try {
            // verify refresh token
            const userSession = (await verifyJWT(
                refreshToken,
                REFRESH_JWT_SECRET_KEY,
            )) as App.UserSession;

            // check userSession has publicKey
            if (!userSession.publicKey) {
                console.log("Invalid refreshToken");
                return json(
                    {
                        status: "error",
                        message: "Invalid refreshToken",
                    },
                    { status: 401 },
                );
            }

            // create new token
            const token = await signJWT(
                { publicKey: userSession.publicKey },
                parseInt(PUBLIC_JWT_EXPIRES_IN),
                JWT_SECRET_KEY,
            );
            cookies.set("token", token, {
                path: "/",
                httpOnly: true,
                secure: true,
                sameSite: "strict",
                maxAge: parseInt(PUBLIC_JWT_EXPIRES_IN), // in seconds
            });
            return json({ status: "success", token });
        } catch (error: any) {
            return json(
                { status: "error", message: error.message },
                { status: 401 },
            );
        }
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
