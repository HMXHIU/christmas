import { JWT_SECRET_KEY, REFRESH_JWT_SECRET_KEY } from "$env/static/private";
import {
    PUBLIC_JWT_EXPIRES_IN,
    PUBLIC_REFRESH_JWT_EXPIRES_IN,
} from "$env/static/public";
import { COUNTRY_DETAILS } from "$lib/userDeviceClient/defs";
import { PublicKey } from "@solana/web3.js";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
    FEE_PAYER_PUBKEY,
    createSerializedTransaction,
    createSignInDataForSIWS,
    hashObject,
    serverAnchorClient,
    signJWT,
    verifyJWT,
    verifySIWS,
} from "..";
import { UserMetadataSchema } from "../crossover/router";
import { ObjectStorage } from "../objectStorage";
import { authProcedure, publicProcedure, t } from "../trpc";

export { CreateUserSchema, LoginSchema, communityRouter };

// Schema
const LoginSchema = z.object({
    solanaSignInInput: z.any(),
    solanaSignInOutput: z.any(),
});
const CreateUserSchema = z.object({
    region: z.array(z.number()),
});

// Router
const communityRouter = {
    // User
    user: t.router({
        // Create
        create: authProcedure
            .input(CreateUserSchema)
            .mutation(async ({ ctx, input }) => {
                const user = ctx.user;
                const { region } = input;

                console.log("region", region);

                // Check valid region
                try {
                    COUNTRY_DETAILS[String.fromCharCode(...region)];
                } catch (err) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: `Invalid region: ${region}`,
                    });
                }

                // Validate & upload user metadata
                const userMetadataUrl = await ObjectStorage.putJSONObject(
                    {
                        owner: null,
                        bucket: "user",
                        name: hashObject(["user", user.publicKey]),
                        data: UserMetadataSchema.parse({
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
                return {
                    transaction: base64Transaction,
                };
            }),
        // User
        user: authProcedure.query(async ({ ctx }) => {
            return await serverAnchorClient.getUser(
                new PublicKey(ctx.user.publicKey),
            );
        }),
    }),

    // Authentication
    auth: t.router({
        // SIWS (public)
        siws: publicProcedure.query(async ({ ctx }) => {
            return await createSignInDataForSIWS();
        }),
        // Login (public)
        login: publicProcedure
            .input(LoginSchema)
            .mutation(async ({ ctx, input }) => {
                // Verify solana signed message
                let { solanaSignInInput, solanaSignInOutput } = input;

                const isVerified = verifySIWS(
                    solanaSignInInput,
                    solanaSignInOutput,
                );

                // Authorized
                if (isVerified) {
                    const userSession: App.UserSession = {
                        publicKey: solanaSignInOutput.address,
                    };

                    // Set token and refresh token on cookies
                    const token = await signJWT(
                        userSession,
                        parseInt(PUBLIC_JWT_EXPIRES_IN),
                        JWT_SECRET_KEY,
                    );
                    const refreshToken = await signJWT(
                        userSession,
                        parseInt(PUBLIC_REFRESH_JWT_EXPIRES_IN),
                        REFRESH_JWT_SECRET_KEY,
                    );
                    // TODO: This seems to be setting 2 set-cookies headers
                    ctx.cookies.set("token", token, {
                        path: "/",
                        httpOnly: true,
                        secure: true,
                        sameSite: "strict",
                        maxAge: parseInt(PUBLIC_JWT_EXPIRES_IN), // in seconds
                    });
                    ctx.cookies.set("refreshToken", refreshToken, {
                        path: "/",
                        httpOnly: true,
                        secure: true,
                        sameSite: "strict",
                        maxAge: parseInt(PUBLIC_REFRESH_JWT_EXPIRES_IN), // in seconds
                    });

                    return { status: "success", token };
                }

                // Unauthorized
                else {
                    ctx.locals.user = null;
                    ctx.cookies.delete("token", {
                        path: "/",
                    });
                    ctx.cookies.delete("refreshToken", {
                        path: "/",
                    });
                    throw new TRPCError({
                        code: "UNAUTHORIZED",
                        message: "Unauthorized",
                    });
                }
            }),

        // Refresh
        refresh: authProcedure.query(async ({ ctx }) => {
            const refreshToken = ctx.cookies.get("refreshToken");

            // Check refreshToken
            if (!refreshToken) {
                throw new TRPCError({
                    code: "UNAUTHORIZED",
                    message: "Missing refreshToken",
                });
            }

            // Verify refresh token
            const userSession = (await verifyJWT(
                refreshToken,
                REFRESH_JWT_SECRET_KEY,
            )) as App.UserSession;

            // Check userSession has publicKey
            if (!userSession.publicKey) {
                console.log("Invalid refreshToken");
                throw new TRPCError({
                    code: "UNAUTHORIZED",
                    message: "Invalid refreshToken",
                });
            }

            // Create new token
            const token = await signJWT(
                { publicKey: userSession.publicKey },
                parseInt(PUBLIC_JWT_EXPIRES_IN),
                JWT_SECRET_KEY,
            );
            ctx.cookies.set("token", token, {
                path: "/",
                httpOnly: true,
                secure: true,
                sameSite: "strict",
                maxAge: parseInt(PUBLIC_JWT_EXPIRES_IN), // in seconds
            });
            return { status: "success", token };
        }),

        // Logout
        logout: authProcedure.query(async ({ ctx }) => {
            ctx.locals.user = null;
            ctx.cookies.delete("token", {
                path: "/",
            });
            ctx.cookies.delete("refreshToken", {
                path: "/",
            });

            return { status: "success" };
        }),

        // User
        user: authProcedure.query(async ({ ctx }) => {
            const user = ctx.locals.user;
            if (user == null) {
                throw new TRPCError({
                    code: "UNAUTHORIZED",
                    message: "You are not logged in",
                });
            }
            return user;
        }),
    }),
};
