import {
    CouponMetadataSchema,
    StoreMetadataSchema,
    UserMetadataSchema,
} from "$lib/clients/anchor-client/types.js";
import { hashObject, requireLogin } from "$lib/server/index.js";
import { BUCKETS, ObjectStorage } from "$lib/server/objectStorage.js";
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

export async function POST(event) {
    const { path } = event.params as { path: string };
    const [bucket, acl] = path.split("/");

    // Require login (user needs to login to upload even if on public bucket)
    const user = requireLogin(event);

    // Check valid bucket
    if (!Object.values(BUCKETS).includes(bucket)) {
        return json(
            { status: "error", message: `Invalid bucket: ${bucket}` },
            { status: 400 },
        );
    }

    // Check valid acl
    if (!["public", "private"].includes(acl)) {
        return json(
            { status: "error", message: `Invalid acl: ${acl}` },
            { status: 400 },
        );
    }

    // Verify data
    const data = await event.request.json();
    let parsedData = data;
    try {
        if (bucket === "coupon") {
            parsedData = await CouponMetadataSchema.validate(data);
        } else if (bucket === "store") {
            parsedData = await StoreMetadataSchema.validate(data);
        } else if (bucket === "user") {
            parsedData = await UserMetadataSchema.validate(data);
        }
    } catch (error: any) {
        return json(
            { status: "error", message: error.message },
            { status: 400 },
        );
    }

    // Object name must be under user namespace (a user can't write to another user's namespace)
    const name = hashObject([bucket, user.publicKey, parsedData]);

    // Get content type
    const contentType = event.request.headers.get("content-type");

    // Upload
    if (contentType === "application/json") {
        const url = await ObjectStorage.putJSONObject({
            owner: acl === "private" ? user.publicKey : null,
            bucket: bucket,
            name: name,
            data: parsedData,
        });
        return json({ status: "success", url });
    }

    return json(
        { status: "error", message: "Invalid content type" },
        { status: 400 },
    );
}
