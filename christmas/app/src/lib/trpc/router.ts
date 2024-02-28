import { SaySchema } from "$lib/crossover/schemas";
import { processCommandSay } from "$lib/server/crossover/game";
import type { Context } from "$lib/trpc/context";
import { TRPCError, initTRPC } from "@trpc/server";

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

// Routers
export const router = t.router({
    // Cmd Router
    cmd: t.router({
        // say
        say: authProcedure.input(SaySchema).query(async ({ ctx, input }) => {
            return processCommandSay(ctx.user, input);
        }),
    }),
});

export type Router = typeof router;
