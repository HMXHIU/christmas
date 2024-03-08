import { login as loginCrossover, signup } from "$lib/crossover";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import type { StreamEventData } from "../../src/routes/api/crossover/stream/+server";
import { createRandomUser } from "../utils";

export { createRandomPlayer, waitForEventData };

async function createRandomPlayer({
    region,
    geohash,
    name,
}: {
    geohash: string;
    region: string;
    name: string;
}): Promise<[NodeWallet, string]> {
    const [wallet, cookies] = await createRandomUser({ region });

    await signup({ name }, { headers: { Cookie: cookies }, wallet });
    await loginCrossover({ geohash, region }, { Cookie: cookies });

    return [wallet, cookies];
}

function waitForEventData(
    eventTarget: EventTarget,
    streamType: string,
    timeout = 1000, // default timeout 1 second
): Promise<StreamEventData> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error("Timeout occurred while waiting for event"));
        }, timeout);

        eventTarget.addEventListener(
            streamType,
            (event: Event) => {
                clearTimeout(timer);
                resolve((event as MessageEvent).data as StreamEventData);
            },
            { once: true },
        );
    });
}
