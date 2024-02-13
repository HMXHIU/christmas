import {
    CouponMetadataSchema,
    StoreMetadataSchema,
    UserMetadataSchema,
} from "$lib/clients/anchor-client/types.js";
import { hashObject, requireLogin } from "$lib/server/index.js";
import { BUCKETS, ObjectStorage } from "$lib/server/objectStorage.js";
import { json } from "@sveltejs/kit";

// Get storage (api/storage/{bucket}/{acl=public|private}/{name})
export async function GET(event) {
    const { path } = event.params as { path: string };
    const [bucket, acl, filename] = path.split("/");

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

    // Check require login
    let owner = null;
    if (acl === "private") {
        const user = requireLogin(event);
        owner = user.publicKey;
    }

    // Get redirect url
    try {
        if (
            [
                BUCKETS.coupon,
                BUCKETS.store,
                BUCKETS.user,
                BUCKETS.image,
            ].includes(bucket)
        ) {
            const redirectUrl = await ObjectStorage.redirectObjectUrl({
                owner,
                bucket,
                name: filename,
            });

            return new Response(null, {
                status: 302,
                headers: {
                    Location: redirectUrl,
                },
            });
        } else {
            return json(
                {
                    status: "error",
                    message: `Invalid bucket: ${bucket} not supported`,
                },
                { status: 400 },
            );
        }
    } catch (error: any) {
        return json(
            { status: "error", message: error.message },
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

    // Get content type
    const contentType =
        event.request.headers.get("content-type") || "octet-stream";

    // Validate data
    let parsedData: any;

    try {
        if (bucket === "coupon") {
            parsedData = await CouponMetadataSchema.validate(
                await event.request.json(),
            );
        } else if (bucket === "store") {
            parsedData = await StoreMetadataSchema.validate(
                await event.request.json(),
            );
        } else if (bucket === "user") {
            parsedData = await UserMetadataSchema.validate(
                await event.request.json(),
            );
        } else if (bucket === "image") {
            // Check data is image
            if (!contentType?.startsWith("image")) {
                return json(
                    {
                        status: "error",
                        message: "Invalid content type: image must be an image",
                    },
                    { status: 400 },
                );
            }
            parsedData = Buffer.from(await event.request.arrayBuffer());
        } else {
            return json(
                {
                    status: "error",
                    message: `Invalid bucket: ${bucket} upload not supported`,
                },
                { status: 400 },
            );
        }
    } catch (error: any) {
        return json(
            { status: "error", message: error.message },
            { status: 400 },
        );
    }

    // Object name must be under user namespace (a user can't write to another user's namespace)
    const name = hashObject([bucket, user.publicKey, parsedData]);

    // Upload
    if (contentType === "application/json") {
        const url = await ObjectStorage.putJSONObject(
            {
                owner: acl === "private" ? user.publicKey : null,
                bucket: bucket,
                name: name,
                data: parsedData,
            },
            { "Content-Type": "application/json" },
        );
        return json({ status: "success", url });
    } else {
        const url = await ObjectStorage.putObject(
            {
                owner: acl === "private" ? user.publicKey : null,
                bucket: bucket,
                name: name,
                data: parsedData,
            },
            { "Content-Type": contentType },
        );
        return json({ status: "success", url });
    }
}
