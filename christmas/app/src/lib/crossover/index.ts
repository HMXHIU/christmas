import { PUBLIC_HOST } from "$env/static/public";
import type { TransactionResult } from "$lib/anchorClient/types";
import { signAndSendTransaction } from "$lib/utils";
import { Transaction } from "@solana/web3.js";

export { player, signup, login, logout, stream, worldSeed };

const worldSeed = "yggdrasil 01";

/**
 * All auth functions requires user to be logged in already via SIWS (use cookies in headers to login without a browser).
 * Override the host if you are testing from a different environment.
 */

async function player(headers: any = {}): Promise<Response> {
    return await fetch(`${PUBLIC_HOST}/api/crossover/auth`, {
        method: "GET",
        headers,
    }).then(async (response) => {
        if (!response.ok) {
            throw new Error(await response.text());
        }
        return response.json();
    });
}

async function signup(
    { name }: { name: string },
    options?: { headers?: HeadersInit; wallet?: any },
): Promise<TransactionResult> {
    return await fetch(`${PUBLIC_HOST || ""}/api/crossover/auth/signup`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(options?.headers || {}),
        },
        body: JSON.stringify({ name }),
    })
        .then(async (response) => {
            if (!response.ok) {
                throw new Error(await response.text());
            }
            return response.json();
        })
        .then(({ transaction }) => {
            return signAndSendTransaction({
                tx: Transaction.from(Buffer.from(transaction, "base64")),
                wallet: options?.wallet,
                commitment: "confirmed",
            });
        });
}

async function login(headers: any = {}): Promise<Response> {
    return await fetch(`${PUBLIC_HOST}/api/crossover/auth/login`, {
        method: "POST",
        headers,
    }).then(async (response) => {
        if (!response.ok) {
            throw new Error(await response.text());
        }
        return response.json();
    });
}

async function logout(headers: any = {}): Promise<Response> {
    return await fetch(`${PUBLIC_HOST}/api/crossover/auth/logout`, {
        method: "POST",
        headers,
    }).then(async (response) => {
        if (!response.ok) {
            throw new Error(await response.text());
        }
        return response.json();
    });
}

async function stream(headers: any = {}): Promise<EventTarget> {
    const eventTarget = new EventTarget();
    const eventStream = makeWriteableEventStream(eventTarget);

    fetch(`${PUBLIC_HOST}/api/crossover/stream`, {
        method: "GET",
        headers,
    }).then(async (response) => {
        if (!response.ok) {
            throw new Error(await response.text());
        }
        if (response.body == null) {
            throw new Error("Missing body in stream response");
        }
        return response.body
            .pipeThrough(new TextDecoderStream())
            .pipeThrough(makeJsonDecoder())
            .pipeTo(eventStream)
            .catch((error) => {
                console.error(error);
                eventTarget.dispatchEvent(
                    new CustomEvent("error", { detail: error }),
                );
            });
    });
    return eventTarget;
}

function makeJsonDecoder(): TransformStream<any, any> {
    return new TransformStream({
        transform(
            chunk: any,
            controller: TransformStreamDefaultController<any>,
        ) {
            try {
                controller.enqueue(JSON.parse(chunk.trim()));
            } catch (err: any) {
                controller.enqueue({
                    type: "system",
                    data: { event: "error", message: err.message },
                });
            }
        },
    });
}

function makeWriteableEventStream(eventTarget: EventTarget) {
    return new WritableStream({
        start(controller) {
            eventTarget.dispatchEvent(
                new MessageEvent("system", { data: { event: "start" } }),
            );
        },
        write(message, controller) {
            eventTarget.dispatchEvent(
                new MessageEvent(message.type, { data: message.data }),
            );
        },
        close() {
            eventTarget.dispatchEvent(
                new MessageEvent("system", { data: { event: "close" } }),
            );
        },
        abort(reason) {
            eventTarget.dispatchEvent(
                new MessageEvent("system", { data: { event: "abort" } }),
            );
        },
    });
}
