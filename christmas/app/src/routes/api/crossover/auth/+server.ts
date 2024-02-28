import { PUBLIC_REFRESH_JWT_EXPIRES_IN } from "$env/static/public";
import { requireLogin } from "$lib/server";
import { getLoadedPlayer, getPlayerMetadata } from "$lib/server/crossover";
import { playerRepository } from "$lib/server/crossover/redis/index.js";
import type { PlayerEntity } from "$lib/server/crossover/redis/schema.js";
import { error, json } from "@sveltejs/kit";

export async function GET(event) {
    const { cookies } = event;
    const userSession = requireLogin(event);

    // Player already loaded
    let player: PlayerEntity | null = await getLoadedPlayer(
        userSession.publicKey,
    );
    if (player == null) {
        // Load player from storage
        let playerMetadata = await getPlayerMetadata(userSession.publicKey);

        if (playerMetadata == null) {
            error(400, `Player ${userSession.publicKey} not found`);
        }

        player = (await playerRepository.save(playerMetadata.player, {
            ...playerMetadata,
            loggedIn: false, // do not login user when creating for the first time from storage
        })) as PlayerEntity;
    }

    // Set player cookie (to know if user has signed up for crossover)
    cookies.set("player", userSession.publicKey, {
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: parseInt(PUBLIC_REFRESH_JWT_EXPIRES_IN), // in seconds
    });

    return json(player);
}
