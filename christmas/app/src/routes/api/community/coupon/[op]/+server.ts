import { PUBLIC_RPC_ENDPOINT } from "$env/static/public";
import {
    FEE_PAYER_PUBKEY,
    createSerializedTransaction,
    requireLogin,
    serverAnchorClient,
} from "$lib/server";
import { PublicKey } from "@solana/web3.js";
import { error, json } from "@sveltejs/kit";
import yup from "yup";

const ClaimCouponParams = yup.object().shape({
    numTokens: yup.number().required().positive().integer(),
    mint: yup.string().required(),
});

const RedeemCouponParams = yup.object().shape({
    coupon: yup.string().required(),
    numTokens: yup.number().required().positive().integer(),
    mint: yup.string().required(),
});

export async function POST(event) {
    // all coupon methods require login
    const user = requireLogin(event);

    const { params } = event;
    const { op } = params;
    let body = await event.request.json();

    // Claim (api/community/coupon/claim)
    if (op === "claim") {
        // Validate request body
        const { numTokens, mint } = await ClaimCouponParams.validate(body);

        const ix = await serverAnchorClient.claimFromMarketIx({
            mint: new PublicKey(mint),
            numTokens,
            wallet: new PublicKey(user.publicKey),
            payer: FEE_PAYER_PUBKEY,
        });

        const base64Transaction = await createSerializedTransaction(ix);
        return json({
            transaction: base64Transaction,
        });
    }

    // Redeem (api/community/coupon/redeem)
    else if (op === "redeem") {
        // Validate request body
        const { coupon, numTokens, mint } =
            await RedeemCouponParams.validate(body);

        const ix = await serverAnchorClient.redeemCouponIx({
            wallet: new PublicKey(user.publicKey),
            payer: FEE_PAYER_PUBKEY,
            coupon: new PublicKey(coupon),
            numTokens,
            mint: new PublicKey(mint),
        });

        const base64Transaction = await createSerializedTransaction(ix);
        return json({
            transaction: base64Transaction,
        });
    }
}
