import { login as loginCrossover, signup } from "$lib/crossover";
import type { Player } from "$lib/server/crossover/redis/entities";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import type { StreamEvent } from "../../src/routes/api/crossover/stream/+server";
import { createRandomUser } from "../utils";

/**
 * Creates a random player with the specified geohash, region, and name.
 * @param geohash The geohash of the player.
 * @param region The region of the player.
 * @param name The name of the player.
 * @returns A promise that resolves to an array containing the NodeWallet and cookies of the player.
 */
export async function createRandomPlayer({
    geohash,
    region,
    name,
}: {
    geohash: string;
    region: string;
    name: string;
}): Promise<[NodeWallet, string, Player]> {
    const [wallet, cookies] = await createRandomUser({ region });

    await signup({ name }, { headers: { Cookie: cookies }, wallet });
    const { status, player } = await loginCrossover(
        { geohash, region },
        { Cookie: cookies },
    );

    return [wallet, cookies, player];
}

/**
 * Waits for a specific event data to be emitted from an event target.
 * @param eventTarget The event target to listen for events on.
 * @param streamType The type of event to listen for.
 * @param timeout The timeout value in milliseconds (default: 1000).
 * @returns A promise that resolves to the emitted event data.
 */
export function waitForEventData(
    eventTarget: EventTarget,
    type: string,
    timeout = 1000, // default timeout 1 second
): Promise<StreamEvent> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error("Timeout occurred while waiting for event"));
        }, timeout);

        eventTarget.addEventListener(
            type,
            (event: Event) => {
                clearTimeout(timer);
                resolve((event as MessageEvent).data as StreamEvent);
            },
            { once: true },
        );
    });
}
