import { requireLogin } from "$lib/server/index.js";
import { json } from "@sveltejs/kit";

// Get global store statistics (api/community/store)
export async function GET(event) {
    const user = requireLogin(event);

    return json({
        message: "Not implemented",
    });
}
