import {
    DUNGEON_MASTER_TOKEN,
    INTERNAL_SERVICE_KEY,
    JWT_SECRET_KEY,
} from "$env/static/private";
import { PUBLIC_ENVIRONMENT } from "$env/static/public";
import { verifyJWT } from "$lib/server";
import { createContext } from "$lib/server/trpc/context";
import { router } from "$lib/server/trpc/router";
import type { Handle } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";
import { createTRPCHandle } from "trpc-sveltekit";

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

    // Internal Service
    if (
        authToken === INTERNAL_SERVICE_KEY ||
        authToken === DUNGEON_MASTER_TOKEN
    ) {
        locals.authToken = authToken;
        return await resolve(event);
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

const handleTRPC: Handle = createTRPCHandle({
    router,
    createContext,
    onError(opts) {
        // Only display debug on console during development
        if (
            PUBLIC_ENVIRONMENT === "development" ||
            PUBLIC_ENVIRONMENT === "production"
        ) {
            console.error(opts.error);
        }
    },
});

export const handle = sequence(handleBase, handleTRPC);

// // Add CORS headers
// response.headers.set('Access-Control-Allow-Origin', '*'); // Or specify the allowed domain
// response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
// response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

// // If it's a preflight request (OPTIONS method), respond with 200
// if (event.request.method === 'OPTIONS') {
//   return new Response(null, {
//     status: 200,
//     headers: response.headers
//   });
// }
