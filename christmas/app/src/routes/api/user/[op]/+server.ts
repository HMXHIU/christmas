import { requireLogin } from "$lib/server/index.js";
import { BUCKETS, ObjectStorage } from "$lib/server/objectStorage.js";
import { json } from "@sveltejs/kit";

export async function POST(event) {
    const { params } = event;
    const { op } = params;

    // Initialize user metadata (api/user/init)
    if (op === "init") {
        // Require login
        const user = requireLogin(event);

        // Check if already initialized
        const exists = await ObjectStorage.objectExists({
            owner: null,
            bucket: BUCKETS.user,
            name: user.publicKey,
        });

        // Already initialized
        if (exists) {
            return json(
                { status: "error", message: "User is already initialized" },
                { status: 400 },
            );
        }
        const data = {
            publicKey: user.publicKey,
        };
        const url = await ObjectStorage.putJSONObject({
            owner: null, // user data is public
            bucket: BUCKETS.user, // user bucket
            name: user.publicKey, // name is the user's public key
            data,
        });
        return json({ status: "success", url });
    }

    return json(
        { status: "error", message: "Invalid operation" },
        { status: 400 },
    );
}

export async function GET(event) {
    /**
     * Get user metadata (might include private data), for public user data just use the metadata url
     *
     * Requires login
     */

    const user = requireLogin(event);

    const data = await ObjectStorage.getJSONObject({
        owner: null,
        bucket: BUCKETS.user,
        name: user.publicKey,
    });

    return json(data);
}
