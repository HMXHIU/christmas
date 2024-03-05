import { JWT_SECRET_KEY } from "$env/static/private";
import { verifyJWT } from "$lib/server";
import { createContext } from "$lib/server/trpc/context";
import { router } from "$lib/server/trpc/router";
import type { Handle } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";
import { createTRPCHandle } from "trpc-sveltekit-monorepo/package/src/"; // TODO: fix this import after test

const handleBase: Handle = async ({ event, resolve }) => {
    const { locals, request, cookies, url } = event;

    // Attempt to get token from cookies
    let authToken = cookies.get("token") || null;

    // Attempt to get token from Authorization header
    if (
        authToken == null &&
        request.headers.get("Authorization")?.startsWith("Bearer ")
    ) {
        authToken =
            request.headers.get("Authorization")?.split("Bearer ")[1] || null;
    }

    // Set locals.user if token is valid (locals.user != null determines if user is logged in)
    if (authToken) {
        try {
            const user = await verifyJWT(authToken, JWT_SECRET_KEY);
            // verify data is UserSession
            if (typeof user !== "object" || user.publicKey == null) {
                throw new Error("Invalid token.");
            }
            locals.user = user as App.UserSession;
        } catch (error: any) {
            console.error("Error verifying token:", error.message);
            locals.user = null;
        }
    } else {
        locals.user = null;
    }

    return await resolve(event);
};

const handleTRPC: Handle = createTRPCHandle({ router, createContext });

export const handle = sequence(handleBase, handleTRPC);
