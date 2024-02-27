import { requireLogin } from "$lib/server";
import type { RequestEvent } from "@sveltejs/kit";
import type { inferAsyncReturnType } from "@trpc/server";

export async function createContext(event: RequestEvent) {
    // All tRPC APIs require login
    const user = requireLogin(event);
    return {
        user,
    };
}

export type Context = inferAsyncReturnType<typeof createContext>;
