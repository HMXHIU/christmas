import { JWT_SECRET_KEY, REFRESH_JWT_SECRET_KEY } from "$env/static/private";
import {
    PUBLIC_JWT_EXPIRES_IN,
    PUBLIC_REFRESH_JWT_EXPIRES_IN,
} from "$env/static/public";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createSignInDataForSIWS, signJWT, verifyJWT, verifySIWS } from "..";
import { authProcedure, publicProcedure, t } from "../trpc";

export { communityRouter };

// Schema
const LoginSchema = z.object({
    solanaSignInInput: z.any(),
    solanaSignInOutput: z.any(),
});

// Router
const communityRouter = {
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
            if (!user) {
                throw new TRPCError({
                    code: "UNAUTHORIZED",
                    message: "You are not logged in",
                });
            }
            return user;
        }),
    }),
};
