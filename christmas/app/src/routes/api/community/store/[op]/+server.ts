import { StoreMetadataSchema } from "$lib/community/types.js";
import {
    FEE_PAYER_PUBKEY,
    createSerializedTransaction,
    hashObject,
    requireLogin,
    serverAnchorClient,
} from "$lib/server";
import { ObjectStorage } from "$lib/server/objectStorage.js";
import { cleanString } from "$lib/utils.js";
import { PublicKey } from "@solana/web3.js";
import { error, json } from "@sveltejs/kit";
import yup from "yup";

const CreateStoreParams = yup.object().shape({
    name: yup.string().required(),
    description: yup.string().required(),
    region: yup.array().of(yup.number().required()).required(),
    geohash: yup.array().of(yup.number().required()).required(),
    latitude: yup.number().required(),
    longitude: yup.number().required(),
    address: yup.string().required(),
});

export async function POST(event) {
    // All store methods require login
    const user = requireLogin(event);
    const { params, request } = event;
    const { op } = params;

    try {
        // Create (api/community/store/create)
        if (op === "create") {
            const { body, image } = Object.fromEntries(
                await request.formData(),
            );

            // Validate request body
            const {
                geohash,
                region,
                name,
                description,
                latitude,
                longitude,
                address,
            } = await CreateStoreParams.validate(JSON.parse(body as string));

            // Validate image
            const imageFile = image as File;
            if (!imageFile) {
                error(400, "Store image is required");
            }

            // Get store id
            const storeId = await serverAnchorClient.getAvailableStoreId();

            // Store image
            const imageUrl = await ObjectStorage.putObject(
                {
                    owner: null,
                    bucket: "image",
                    name: hashObject([
                        "image",
                        user.publicKey,
                        storeId.toNumber(),
                    ]),
                    data: Buffer.from(await imageFile.arrayBuffer()),
                },
                { "Content-Type": imageFile.type },
            );

            // Validate & upload store metadata
            const storeMetadataUrl = await ObjectStorage.putJSONObject(
                {
                    owner: null,
                    bucket: "store",
                    name: hashObject([
                        "store",
                        user.publicKey,
                        storeId.toNumber(),
                    ]),
                    data: await StoreMetadataSchema.validate({
                        name,
                        description,
                        address,
                        latitude,
                        longitude,
                        image: imageUrl,
                    }),
                },
                { "Content-Type": "application/json" },
            );

            const ix = await serverAnchorClient.createStoreIx({
                name,
                uri: storeMetadataUrl,
                region,
                geohash,
                storeId,
                payer: FEE_PAYER_PUBKEY,
                wallet: new PublicKey(user.publicKey),
            });

            const base64Transaction = await createSerializedTransaction(ix);
            return json({
                transaction: base64Transaction,
            });
        }
    } catch (err: any) {
        console.error(err);
        error(500, err.message);
    }
}

export async function GET(event) {
    // All store methods require login
    const user = requireLogin(event);

    const { params, url } = event;
    const { op } = params;

    // Get store metadata (api/community/store/metadata?store=<store>)
    if (op === "metadata") {
        const storePda = url.searchParams.get("store") || null;

        if (storePda == null) {
            error(400, "Store is required");
        }

        const store = await serverAnchorClient.getStoreByPda(
            new PublicKey(storePda),
        );

        // redirect to store.uri
        return new Response(null, {
            status: 302,
            headers: {
                Location: cleanString(store.uri),
            },
        });
    }

    // Get logged in user's stores (api/community/store/user)
    else if (op === "user") {
        return json(
            await serverAnchorClient.getStores(new PublicKey(user.publicKey)),
        );
    }
}
