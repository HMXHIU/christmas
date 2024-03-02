import { UserMetadataSchema } from "$lib/community/types.js";
import {
    FEE_PAYER_PUBKEY,
    createSerializedTransaction,
    hashObject,
    requireLogin,
    serverAnchorClient,
} from "$lib/server";
import { ObjectStorage } from "$lib/server/objectStorage.js";
import { COUNTRY_DETAILS } from "$lib/userDeviceClient/defs";
import { PublicKey } from "@solana/web3.js";
import { error, json } from "@sveltejs/kit";
import yup from "yup";

const CreateUserParams = yup.object().shape({
    region: yup.array().of(yup.number().required()).required(),
});

export async function POST(event) {
    // all user methods require login
    const user = requireLogin(event);

    const { params } = event;
    const { op } = params;
    let body = await event.request.json();

    // Create User (api/community/user/create)
    if (op === "create") {
        // Validate request body
        const { region } = await CreateUserParams.validate(body);

        // Check valid region
        try {
            COUNTRY_DETAILS[String.fromCharCode(...region)];
        } catch (err) {
            error(400, `Invalid region: ${region}`);
        }

        // Validate & upload user metadata
        const userMetadataUrl = await ObjectStorage.putJSONObject(
            {
                owner: null,
                bucket: "user",
                name: hashObject(["user", user.publicKey]),
                data: await UserMetadataSchema.validate({
                    publicKey: user.publicKey,
                }),
            },
            { "Content-Type": "application/json" },
        );

        const ix = await serverAnchorClient.createUserIx({
            wallet: new PublicKey(user.publicKey),
            payer: FEE_PAYER_PUBKEY,
            region: region,
            uri: userMetadataUrl,
        });

        const base64Transaction = await createSerializedTransaction(ix);
        return json({
            transaction: base64Transaction,
        });
    }
}
