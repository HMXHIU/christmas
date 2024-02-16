import { CouponMetadataSchema } from "$lib/community/types.js";
import {
    FEE_PAYER_PUBKEY,
    createSerializedTransaction,
    hashObject,
    requireLogin,
    serverAnchorClient,
} from "$lib/server";
import { ObjectStorage } from "$lib/server/objectStorage.js";
import { Keypair, PublicKey } from "@solana/web3.js";
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

const VerifyRedemptionParams = yup.object().shape({
    signature: yup.string().required(),
    mint: yup.string().required(),
    wallet: yup.string().required(),
    numTokens: yup.number().required().positive().integer(),
});

const MintCouponParams = yup.object().shape({
    region: yup.array().of(yup.number().required()).required(),
    mint: yup.string().required(),
    coupon: yup.string().required(),
    numTokens: yup.number().required().positive().integer(),
});

const CreateCouponParams = yup.object().shape({
    name: yup.string().required(),
    description: yup.string().required(),
    region: yup.array().of(yup.number().required()).required(),
    geohash: yup.array().of(yup.number().required()).required(),
    store: yup.string().required(),
    validFrom: yup.date().required(),
    validTo: yup.date().required(),
});

const MarketCouponParams = yup.object().shape({
    region: yup.array().of(yup.number().required()).required(),
    geohash: yup.array().of(yup.number().required()).required(),
});

export async function POST(event) {
    // all coupon methods require login
    const user = requireLogin(event);
    const { params, request } = event;
    const { op } = params;
    let body = await request.json();

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

    // Verify (api/community/coupon/verify)
    else if (op === "verify") {
        // Validate request body
        const { signature, mint, wallet, numTokens } =
            await VerifyRedemptionParams.validate(body);

        const { isVerified, err } = await serverAnchorClient.verifyRedemption({
            mint: new PublicKey(mint),
            wallet: new PublicKey(wallet),
            numTokens,
            signature,
        });

        return json({
            isVerified,
            err,
        });
    }

    // Mint (api/community/coupon/mint)
    else if (op === "mint") {
        // Validate request body
        const { region, mint, coupon, numTokens } =
            await MintCouponParams.validate(body);

        const ix = await serverAnchorClient.mintToMarketIx({
            mint: new PublicKey(mint),
            coupon: new PublicKey(coupon),
            numTokens,
            region,
            payer: FEE_PAYER_PUBKEY,
            wallet: new PublicKey(user.publicKey),
        });

        const base64Transaction = await createSerializedTransaction(ix);
        return json({
            transaction: base64Transaction,
        });
    }

    // Create (api/community/coupon/create)
    else if (op === "create") {
        // Validate request body
        const {
            geohash,
            region,
            name,
            description,
            store,
            validFrom,
            validTo,
        } = await CreateCouponParams.validate(body);

        // Validate image
        const imageFile = (await request.formData()).get("image") as File;
        if (!imageFile) {
            error(400, "Coupon image is required");
        }

        // Generate a new mint for coupon
        const mint = Keypair.generate();

        // Upload image
        const imageUrl = await ObjectStorage.putObject(
            {
                owner: null,
                bucket: "image",
                name: hashObject([
                    "image",
                    user.publicKey,
                    mint.publicKey.toBase58(),
                ]),
                data: Buffer.from(await imageFile.arrayBuffer()),
            },
            { "Content-Type": "image" },
        );

        // Validate & upload coupon metadata
        const metadata = await CouponMetadataSchema.validate({
            name,
            description,
            image: imageUrl,
        });
        const couponMetadataUrl = await ObjectStorage.putJSONObject(
            {
                owner: null,
                bucket: "coupon",
                name: hashObject([
                    "coupon",
                    user.publicKey,
                    mint.publicKey.toBase58(),
                ]),
                data: metadata,
            },
            { "Content-Type": "application/json" },
        );

        const ix = await serverAnchorClient.createCouponIx({
            mint,
            name,
            region,
            geohash,
            store: new PublicKey(store),
            validFrom,
            validTo,
            uri: couponMetadataUrl,
            payer: FEE_PAYER_PUBKEY,
            wallet: new PublicKey(user.publicKey),
        });

        const base64Transaction = await createSerializedTransaction(ix, [mint]); // mint needs to sign as well
        return json({
            transaction: base64Transaction,
        });
    }
}

export async function GET(event) {
    const { params, url } = event;
    const { op } = params;

    // require login
    const user = requireLogin(event);

    // Minted Coupons (api/community/coupon/claimed?store=<store>)
    if (op === "minted") {
        // Get store
        const store = url.searchParams.get("store") || null;
        if (store == null) {
            error(400, "Store is required");
        }

        const coupons = await serverAnchorClient.getMintedCoupons(
            new PublicKey(store),
        );

        return json(coupons);
    }

    // Claimed Coupons (api/community/coupon/claimed)
    else if (op === "claimed") {
        const coupons = await serverAnchorClient.getClaimedCoupons(
            new PublicKey(user.publicKey),
        );
        return json(coupons);
    }

    // Market Coupons (api/community/coupon/market?region=<region>&geohash=<geohash>)
    else if (op === "market") {
        const coupons = await serverAnchorClient.getCoupons({
            ...(await MarketCouponParams.validate({
                region: url.searchParams.get("region"),
                geohash: url.searchParams.get("geohash"),
            })),
            date: new Date(), // current date
        });
        return json(coupons);
    }
}
