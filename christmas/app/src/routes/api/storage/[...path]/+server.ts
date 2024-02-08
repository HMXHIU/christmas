import { requireLogin } from "$lib/server/index.js";
import { ObjectStorage } from "$lib/server/objectStorage.js";
import { json } from "@sveltejs/kit";

export async function GET(event) {
    const { path } = event.params as { path: string };
    const [bucket, acl, filename] = path.split("/");

    if (acl === "private") {
        const user = requireLogin(event);
        if (filename !== user.publicKey) {
            return json(
                {
                    status: "error",
                    message: "Permission denied: user does not own file",
                },
                { status: 403 },
            );
        }

        try {
            return json(
                await ObjectStorage.getJSONObject({
                    owner: user.publicKey,
                    bucket,
                    name: filename,
                }),
            );
        } catch (error: any) {
            return json(
                { status: "error", message: error.message },
                { status: 400 },
            );
        }
    } else if (acl === "public") {
        try {
            return json(
                await ObjectStorage.getJSONObject({
                    owner: null,
                    bucket,
                    name: filename,
                }),
            );
        } catch (error: any) {
            return json(
                { status: "error", message: error.message },
                { status: 400 },
            );
        }
    } else {
        return json(
            {
                status: "error",
                message:
                    "Invalid URL, must be {bucket}/{acl=public|private}/{name}",
            },
            { status: 400 },
        );
    }
}
