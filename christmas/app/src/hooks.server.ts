import { verifyJWT } from "$lib/server";

export async function handle({ event, resolve }) {
    const { locals, request, cookies } = event;

    // Get token from cookies or Authorization header
    let authToken = cookies.get("token");
    if (
        !authToken &&
        request.headers.get("Authorization")?.startsWith("Bearer ")
    ) {
        authToken = request.headers.get("Authorization")?.split("Bearer ")[1];
    }

    // Set user in locals if token is valid (locals.user != null determines if user is logged in)
    if (authToken) {
        try {
            locals.user = await verifyJWT(authToken);
        } catch (error) {
            locals.user = null;
        }
    }

    return await resolve(event);
}
