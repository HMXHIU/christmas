import { PUBLIC_HOST } from "$env/static/public";
import type { Router } from "$lib/server/trpc/router";
import type { HTTPHeaders } from "@trpc/client";
import { createTRPCClient, type TRPCClientInit } from "trpc-sveltekit";

let browserClient: ReturnType<typeof createTRPCClient<Router>>;

export function trpc(opts?: { init?: TRPCClientInit; headers?: HTTPHeaders }) {
    const isBrowser = typeof window !== "undefined";
    if (isBrowser && browserClient) return browserClient;
    const client = createTRPCClient<Router>({
        init: opts?.init || {
            fetch, // automatically use window.fetch or node-fetch depending on the environment
            url: {
                origin: PUBLIC_HOST,
            },
        },
        headers: opts?.headers,
    });
    if (isBrowser) browserClient = client;
    return client;
}
