import { CouponMetadataSchema } from "$lib/community/types.js";
import {
    FEE_PAYER_PUBKEY,
    createSerializedTransaction,
    hashObject,
    requireLogin,
    serverAnchorClient,
} from "$lib/server";
import { ObjectStorage } from "$lib/server/objectStorage.js";
import { stringToUint8Array } from "$lib/utils.js";
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
    region: yup.string().required(),
    geohash: yup.string().required(),
});

export async function POST(event) {
    // all coupon methods require login
    const user = requireLogin(event);
    const { params, request } = event;
    const { op } = params;

    try {
        // Claim (api/community/coupon/claim)
        if (op === "claim") {
            let body = await request.json();

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
            let body = await request.json();

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
            let body = await request.json();

            // Validate request body
            const { signature, mint, wallet, numTokens } =
                await VerifyRedemptionParams.validate(body);

            const { isVerified, err } =
                await serverAnchorClient.verifyRedemption({
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
            let body = await request.json();

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
            const { body, image } = Object.fromEntries(
                await request.formData(),
            );

            // Validate request body
            const {
                geohash,
                region,
                name,
                description,
                store,
                validFrom,
                validTo,
            } = await CreateCouponParams.validate(JSON.parse(body as string));

            // Validate image
            const imageFile = image as File;
            if (!imageFile) {
                error(400, "Store image is required");
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
                { "Content-Type": imageFile.type },
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

            const base64Transaction = await createSerializedTransaction(ix, [
                mint,
            ]); // mint needs to sign as well
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
    const { params, url } = event;
    const { op } = params;

    // require login
    const user = requireLogin(event);

    // Minted Coupons (api/community/coupon/minted?store=<store>)
    if (op === "minted") {
        // Get store
        const store = url.searchParams.get("store") || null;
        if (store == null) {
            error(400, "Store is required");
        }

        const coupons = await serverAnchorClient.getMintedCoupons({
            store: new PublicKey(store),
        });

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
        const { region, geohash } = await MarketCouponParams.validate({
            region: url.searchParams.get("region"),
            geohash: url.searchParams.get("geohash"),
        });

        const coupons = await serverAnchorClient.getCoupons({
            region: Array.from(stringToUint8Array(region)),
            geohash: Array.from(stringToUint8Array(geohash)),
            date: new Date(), // current date
        });
        return json(coupons);
    }
}
