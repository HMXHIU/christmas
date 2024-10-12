import {
    type PlayerAppearance,
    type PlayerDemographic,
} from "$lib/crossover/world/player";
import { ObjectStorage } from "$lib/server/objectStorage";
import { hashObject } from "..";

export { generateAvatarHash, getAvatars, getAvatarTextures };

function generateAvatarHash({
    demographic,
    appearance,
    textures,
}: {
    demographic: PlayerDemographic;
    appearance: PlayerAppearance;
    textures: Record<string, string>;
}): { selector: string; texture: string; hash: string } {
    // Searching by using the prefix as the selector will give multiple texture combinations
    const s = hashObject({ demographic, appearance }, "md5"); // md5 is shorter
    const t = hashObject({ textures }, "md5");
    return { selector: s, texture: t, hash: `${s}_${t}` };
}

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
        console.log("Store avatar image", avatarImageUrl);
        return [avatarImageUrl];
    } else {
        return bucketItems.map((item) => {
            return ObjectStorage.objectUrl({
                owner: null, // public
                bucket: "avatar",
                name: item.name!.split("/").slice(-1)[0], // remove prefix (public, private)
            });
        });
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
            head: "/images/head/face/female_default/face.png",
            front_hair: "/images/head/hair/female_long/front_hair.png",
            back_hair: "/images/head/hair/female_long/back_hair.png",
        };
    }
    // Female
    else {
        textures = {
            head: "/images/head/face/female_default/face.png",
            front_hair: "/images/head/hair/female_long/front_hair.png",
            back_hair: "/images/head/hair/female_long/back_hair.png",
        };
    }

    return textures;
}
