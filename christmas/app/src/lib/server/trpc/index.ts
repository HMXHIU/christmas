import { TRPCError, initTRPC } from "@trpc/server";
import type { Context } from "./context";

// Builder
export const t = initTRPC.context<Context>().create();

// Procedures
export const publicProcedure = t.procedure;
export const authProcedure = t.procedure.use(async function isAuthed(opts) {
    const { ctx } = opts;
    if (!ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return opts.next({
        ctx: {
            user: ctx.user,
        },
    });
});
