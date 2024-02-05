import { verifyJWT } from "$lib/server";

export async function handle({ event, resolve }) {
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

    console.log("authToken", authToken);

    // Set locals.user if token is valid (locals.user != null determines if user is logged in)
    if (authToken) {
        try {
            const user = await verifyJWT(authToken);
            // verify jwt data is UserSession
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
}
