import { requireLogin, serverAnchorClient } from "$lib/server/index.js";
import { PublicKey } from "@solana/web3.js";
import { json } from "@sveltejs/kit";

// Get user (api/community/user)
export async function GET(event) {
    // Requires login
    const user = requireLogin(event);

    return json(
        await serverAnchorClient.getUser(new PublicKey(user.publicKey)),
    );
}
