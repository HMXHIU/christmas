import {
    StoreMetadataSchema,
    type StoreMetadata,
} from "$lib/clients/anchor-client/types.js";
import { hashObject, requireLogin } from "$lib/server/index.js";
import { BUCKETS, ObjectStorage } from "$lib/server/objectStorage.js";
import { json } from "@sveltejs/kit";

export async function POST(event) {
    const { params, request } = event;
    const { op } = params;

    // TODO: Change to new token extension to store metadata in the mint itself
    //       Right now there is no link between the store and the metadata
    //
    // Create store metadata (api/store/create)
    if (op === "create") {
        // Require login
        const user = requireLogin(event);

        // Get StoreMetadata from the request body
        const data = await request.json();

        // Validate schema
        let metadata: StoreMetadata;
        try {
            metadata = await StoreMetadataSchema.validate(data);
        } catch (error: any) {
            return json(
                { status: "error", message: error.message },
                { status: 400 },
            );
        }

        // Get hash of metadata (use it as the name)
        const hash = hashObject(metadata);

        // Check if already initialized
        const exists = await ObjectStorage.objectExists({
            owner: null,
            bucket: BUCKETS.store,
            name: hash,
        });

        // Already initialized
        if (exists) {
            return json(
                { status: "error", message: "Store metadata already exists" },
                { status: 400 },
            );
        }

        const url = await ObjectStorage.putJSONObject({
            owner: null, // store metadata is public
            bucket: BUCKETS.store,
            name: hash,
            data: metadata,
        });
        return json({ status: "success", url });
    }

    return json(
        { status: "error", message: "Invalid operation" },
        { status: 400 },
    );
}
