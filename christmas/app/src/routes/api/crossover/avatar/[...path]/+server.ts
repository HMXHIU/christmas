import {
    type PlayerAppearance,
    type PlayerDemographic,
} from "$lib/crossover/world/player";
import { requireLogin } from "$lib/server";
import { generateAvatarHash } from "$lib/server/crossover/player";
import { ObjectStorage } from "$lib/server/objectStorage";
import type { RequestHandler } from "@sveltejs/kit";

export { getAvatars };

async function getAvatars({
    demographic,
    appearance,
}: {
    demographic: PlayerDemographic;
    appearance: PlayerAppearance;
}): Promise<string[]> {
    // Generate avatar hashes
    const textures = getAvatarTextures({ demographic, appearance });
    const { selector, texture, hash } = generateAvatarHash({
        demographic,
        appearance,
        textures,
    });

    // Find all possible avatar textures with filename prefix containing the selector hash
    const bucketItems = await ObjectStorage.listObjects({
        owner: null,
        bucket: "avatar",
        prefix: selector,
        maxKeys: 3,
    });

    // Generate if no existing avatar
    if (bucketItems.length < 1) {
        // Upload avatar to ObjectStorage
        const avatarImageUrl = await ObjectStorage.putJSONObject({
            owner: null, // public
            bucket: "avatar",
            name: hash,
            data: textures,
        });
        return [avatarImageUrl];
    } else {
        const urls = bucketItems.map((item) => {
            return ObjectStorage.objectUrl({
                owner: null, // public
                bucket: "avatar",
                name: item.name!.split("/").slice(-1)[0], // remove prefix (public, private)
            });
        });
        return urls;
    }
}

function getAvatarTextures({
    demographic,
    appearance,
}: {
    demographic: PlayerDemographic;
    appearance: PlayerAppearance;
}): Record<string, string> {
    let textures = {};
    // Male
    if (demographic.gender === "male") {
        textures = {
            head: "http://localhost:5173/avatar/images/head/face/female_default/face.png",
            front_hair:
                "http://localhost:5173/avatar/images/head/hair/female_long/front_hair.png",
            back_hair:
                "http://localhost:5173/avatar/images/head/hair/female_long/back_hair.png",
        };
    }
    // Female
    else {
        textures = {
            head: "http://localhost:5173/avatar/images/head/face/female_default/face.png",
            front_hair:
                "http://localhost:5173/avatar/images/head/hair/female_long/front_hair.png",
            back_hair:
                "http://localhost:5173/avatar/images/head/hair/female_long/back_hair.png",
        };
    }

    return textures;
}

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
