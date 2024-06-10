import { COMFYUI_REST_ENDPOINT } from "$env/static/private";
// import { requireLogin } from "$lib/server";
import type { PlayerMetadataSchema } from "$lib/crossover/world/player";
import { hashObject } from "$lib/server";
import { ObjectStorage } from "$lib/server/objectStorage";
import { sleep } from "$lib/utils";
import type { RequestHandler } from "@sveltejs/kit";
import type { z } from "zod";
import workflow from "./crossover_comfyui_character_creator.json";

/*
 *  See ComfyUI endpoitns here:
 *  https://github.com/comfyanonymous/ComfyUI/blob/master/server.py
 */

async function getSystemStats() {
    const stats = await (
        await fetch(`${COMFYUI_REST_ENDPOINT}/system_stats`)
    ).json();
    return stats;
}

async function getQueue() {
    const queue = await (await fetch(`${COMFYUI_REST_ENDPOINT}/queue`)).json();
    return queue;
}

async function getHistory(promptId?: string) {
    promptId = promptId || "";
    const history = await (
        await fetch(`${COMFYUI_REST_ENDPOINT}/history/${promptId}`)
    ).json();
    return history;
}

async function getOutputs(promptId: string) {
    const history = await getHistory(promptId);

    if (history[promptId] === undefined) {
        return null;
    }

    const { outputs, status } = history[promptId];

    if (status.completed === true && status.status_str === "success") {
        return outputs;
    }

    return null;
}

function createPrompt() {
    return workflow;
}

async function queuePrompt({
    attempts,
    playerMetadata,
}: {
    attempts?: number;
    playerMetadata: z.infer<typeof PlayerMetadataSchema>;
}) {
    attempts = attempts || 10;

    // Queue the prompt
    const { prompt_id } = await (
        await fetch(`${COMFYUI_REST_ENDPOINT}/prompt`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ prompt: createPrompt() }),
        })
    ).json();

    // Poll the history
    let result = null;
    while (attempts > 0) {
        await sleep(2000);
        result = getOutputs(prompt_id);
        if (result == null) {
            continue;
        }
        attempts--;
    }

    return result;
}

/*
 *Generate a random seed for use in stable diffusion
 */
function generateRandomSeed(): number {
    // Define the range for the seed, e.g., 0 to 2^32 - 1
    const maxSeed = Math.pow(2, 32) - 1;
    // Generate a random integer within the range
    const randomSeed = Math.floor(Math.random() * maxSeed);
    return randomSeed;
}

async function createAvatar(
    playerMetadata: z.infer<typeof PlayerMetadataSchema>,
): Promise<{ avatarImageUrl: string }> {
    // Generate random seed for kSampler
    const samplerSeed = generateRandomSeed();

    // Generate avatar hash
    const { gender, race, archetype, appearance } = playerMetadata;
    const avatarHash = hashObject({ gender, race, archetype, appearance });

    // Create filename for the avatar
    const avatarFilename = `${avatarHash}-${samplerSeed}.png`;

    // Check if avatar already exists in ObjectStorage
    if (
        await ObjectStorage.objectExists({
            owner: null,
            bucket: "avatar",
            name: avatarFilename,
        })
    ) {
        return {
            avatarImageUrl: ObjectStorage.objectUrl({
                owner: null,
                bucket: "avatar",
                name: avatarFilename,
            }),
        };
    }

    // Create and queue the prompt, get the output results
    const outputs = await queuePrompt({ attempts: 10, playerMetadata });

    // Get the result of the output node
    const node_id = "97";
    const { filename, subfolder, type } = outputs[node_id].images[0];

    // Get the temp image url of the output node
    const urlParams = new URLSearchParams({
        filename,
        subfolder,
        type,
    });
    const tempImageUrl = `${COMFYUI_REST_ENDPOINT}/view?${urlParams.toString()}`;

    // Fetch image from tempImageUrl
    const response = await fetch(tempImageUrl);
    const imageBuffer = Buffer.from(await response.arrayBuffer());

    // Upload avatar to ObjectStorage
    const avatarImageUrl = await ObjectStorage.putObject(
        {
            owner: null, // public
            bucket: "avatar",
            name: avatarFilename,
            data: imageBuffer,
        },
        { "Content-Type": response.headers.get("content-type") || "image/png" },
    );

    return { avatarImageUrl };
}

async function getAvatars(
    playerMetadata: z.infer<typeof PlayerMetadataSchema>,
): Promise<string[]> {
    // Generate avatar hash
    const { gender, race, archetype, appearance } = playerMetadata;
    const avatarHash = hashObject({ gender, race, archetype, appearance });

    // Find all avatar's with filename prefix containing the avatarHash
    const bucketItems = await ObjectStorage.listObjects({
        owner: null,
        bucket: "avatar",
        prefix: avatarHash,
        maxKeys: 3,
    });

    return bucketItems.map((item) => {
        return ObjectStorage.objectUrl({
            owner: null,
            bucket: "avatar",
            name: item.name!.split("/").slice(-1)[0], // remove prefix (public, private)
        });
    });
}

export const GET: RequestHandler = async (event) => {
    // TODO: reenable after testing
    // const user = requireLogin(event);

    const { path } = event.params as { path: string };
    const [operation] = path.split("/");

    if (operation === "system_stats") {
        return Response.json(await getSystemStats());
    } else if (operation === "queue") {
        return Response.json(await getQueue());
    } else if (operation === "history") {
        return Response.json(await getHistory());
    } else if (operation === "workflow") {
        return Response.json(createPrompt());
    }

    return Response.json(
        { status: "error", message: "Invalid operation" },
        { status: 400 },
    );
};

export const POST: RequestHandler = async (event) => {
    // TODO: reenable after testing
    // const user = requireLogin(event);

    const { path } = event.params as { path: string };
    const [operation] = path.split("/");

    if (operation === "create") {
        // TODO: set player avatar if he chose it, need to set limits, player cannot set the url from frontend to any image
        //       it must be the url generated & validated from the character creator

        let playerMetadata = await event.request.json();
        const avatarMetadata = await createAvatar(playerMetadata);
        return Response.json(avatarMetadata);
    } else if (operation === "avatars") {
        let playerMetadata = await event.request.json();
        const avatars = await getAvatars(playerMetadata);
        return Response.json({ avatars });
    }

    return Response.json(
        { status: "error", message: "Invalid operation" },
        { status: 400 },
    );
};
