import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { createRandomUser } from "../utils";
import { signup, login as loginCrossover } from "$lib/crossover";

export { createRandomPlayer, waitForEventData };

async function createRandomPlayer({
    region,
    name,
}: {
    region: string;
    name: string;
}): Promise<[NodeWallet, string]> {
    const [wallet, cookies] = await createRandomUser({ region });

    await signup({ name }, { headers: { Cookie: cookies }, wallet });
    await loginCrossover({ Cookie: cookies });

    return [wallet, cookies];
}

function waitForEventData(
    eventTarget: EventTarget,
    eventName: string,
    timeout = 1000, // default timeout 1 second
): Promise<Event> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error("Timeout occurred while waiting for event"));
        }, timeout);

        eventTarget.addEventListener(
            eventName,
            (event: Event) => {
                clearTimeout(timer);
                resolve((event as MessageEvent).data);
            },
            { once: true },
        );
    });
}
