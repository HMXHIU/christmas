import { requireLogin } from "$lib/server/index.js";
import { json } from "@sveltejs/kit";

// Global coupon statistics
export async function GET(event) {
    const user = requireLogin(event);
    return json({
        message: "Not implemented",
    });
}
