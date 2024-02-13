import { COUNTRY_DETAILS } from "$lib/clients/user-device-client/defs";
import {
    FEE_PAYER_PUBKEY,
    createSerializedTransaction,
    requireLogin,
    serverAnchorClient,
} from "$lib/server";
import { PublicKey } from "@solana/web3.js";
import { error, json } from "@sveltejs/kit";
import yup from "yup";

const CreateUserParams = yup.object().shape({
    region: yup.array().of(yup.number().required()).required(),
    uri: yup.string().optional(),
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
        const { region, uri } = await CreateUserParams.validate(body);

        // check valid region (TODO: check should be moved into AnchorClient or backend)
        try {
            COUNTRY_DETAILS[String.fromCharCode(...region)];
        } catch (err) {
            error(400, `Invalid region: ${region}`);
        }

        const ix = await serverAnchorClient.createUserIx({
            wallet: new PublicKey(user.publicKey),
            payer: FEE_PAYER_PUBKEY,
            region: region,
            uri: uri || "",
        });

        const base64Transaction = await createSerializedTransaction(ix);
        return json({
            transaction: base64Transaction,
        });
    }
}
