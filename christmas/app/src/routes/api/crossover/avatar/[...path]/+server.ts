import { requireLogin } from "$lib/server";
import { getAvatars } from "$lib/server/crossover/avatar";
import type { RequestHandler } from "@sveltejs/kit";

export const POST: RequestHandler = async (event) => {
    const user = requireLogin(event);
    const { path } = event.params as { path: string };
    const [operation] = path.split("/");

    // Avatars
    if (operation === "avatars") {
        const avatars = await getAvatars(await event.request.json());
        return Response.json({ avatars });
    }

    return Response.json(
        { status: "error", message: "Invalid operation" },
        { status: 400 },
    );
};
