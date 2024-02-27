import type { Context } from "$lib/trpc/context";
import { initTRPC } from "@trpc/server";
import delay from "delay";

export const t = initTRPC.context<Context>().create();

export const router = t.router({
    greeting: t.procedure.query(async ({ ctx }) => {
        await delay(500); // 👈 simulate an expensive operation
        return `Hello ${ctx.user.publicKey} tRPC v10 @ ${new Date().toLocaleTimeString()}`;
    }),
});

export type Router = typeof router;
