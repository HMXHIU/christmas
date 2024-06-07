import { COMFYUI_REST_ENDPOINT } from "$env/static/private";
import { requireLogin } from "$lib/server";
import { sleep } from "$lib/utils";
import type { RequestHandler } from "@sveltejs/kit";
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

async function createAvatarFromOutputs(outputs: any) {
    const node_id = "97";
    const { filename, subfolder, type } = outputs[node_id].images[0];
    const urlParams = new URLSearchParams({
        filename,
        subfolder,
        type,
    });
    const avatarImageUrl = `${COMFYUI_REST_ENDPOINT}/view?${urlParams.toString()}`;
    return avatarImageUrl;
}

function createPrompt() {
    return workflow;
}

async function queuePrompt({ attempts }: { attempts?: number }) {
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

export const GET: RequestHandler = async (event) => {
    const user = requireLogin(event);

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
    } else if (operation === "create") {
        const outputs = await queuePrompt({ attempts: 10 });
        const avatarImageUrl = await createAvatarFromOutputs(outputs);
        return await fetch(avatarImageUrl);
    }

    return Response.json(
        { status: "error", message: "Invalid operation" },
        { status: 400 },
    );
};
