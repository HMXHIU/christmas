import { INTERNAL_SERVICE_KEY } from "$env/static/private";
import { login as loginCrossover, signup } from "$lib/crossover";
import {
    archetypeTypes,
    type PlayerMetadata,
} from "$lib/crossover/world/player";
import { hashObject } from "$lib/server";
import type { Monster, Player } from "$lib/server/crossover/redis/entities";
import { ObjectStorage } from "$lib/server/objectStorage";
import { generateRandomSeed } from "$lib/utils";
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

    const playerMetadata: PlayerMetadata = {
        player: wallet.publicKey.toBase58(),
        name,
        description: "",
        avatar: "",
        gender: "male",
        race: "human",
        archetype: "fighter",
        attributes: archetypeTypes[0].attributes,
        appearance: {
            hair: {
                type: "afro",
                color: "ash_blonde",
            },
            eye: {
                type: "almond",
                color: "amber",
            },
            face: "angular",
            body: "athletic",
            skin: "alabaster",
            personality: "adventurous",
            age: "adult",
        },
    };
    const avatarHash = hashObject({
        gender: playerMetadata.gender,
        race: playerMetadata.race,
        archetype: playerMetadata.archetype,
        appearance: playerMetadata.appearance,
    });
    const avatarFilename = `${avatarHash}-${generateRandomSeed()}.png`;
    playerMetadata.avatar = `https://example.com/avatar/${avatarFilename}`;

    await ObjectStorage.putObject({
        owner: null,
        bucket: "avatar",
        name: avatarFilename,
        data: Buffer.from(""),
    });

    await signup(playerMetadata, { headers: { Cookie: cookies }, wallet });
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
    timeout = 500, // default timeout 500 ms
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

export function collectEventDataForDuration(
    eventTarget: EventTarget,
    type: string,
    duration = 500,
): Promise<StreamEvent[]> {
    return new Promise((resolve, reject) => {
        const events: StreamEvent[] = [];
        const f = (event: Event) => {
            events.push((event as MessageEvent).data as StreamEvent);
        };

        setTimeout(() => {
            eventTarget.removeEventListener(type, f);
            resolve(events);
        }, duration);

        eventTarget.addEventListener(type, (event: Event) => {
            events.push((event as MessageEvent).data as StreamEvent);
        });
    });
}

export function generateRandomGeohash(
    precision: number,
    startsWith?: string,
): string {
    const evenChars = "bcfguvyz89destwx2367kmqr0145hjnp".split("");
    const oddChars = "prxznqwyjmtvhksu57eg46df139c028b".split("");

    let geohash = startsWith || "";
    for (let i = geohash.length; i < precision; i++) {
        if (i % 2 === 0) {
            geohash += evenChars[Math.floor(Math.random() * evenChars.length)];
        } else {
            geohash += oddChars[Math.floor(Math.random() * oddChars.length)];
        }
    }

    return geohash;
}

export async function buffEntity(
    entity: string,
    {
        level,
        hp,
        mp,
        st,
        ap,
        buffs,
        debuffs,
    }: {
        level?: number;
        hp?: number;
        mp?: number;
        st?: number;
        ap?: number;
        buffs?: string[];
        debuffs?: string[];
    },
): Promise<Player | Monster> {
    const { result } = await (
        await fetch("http://localhost:5173/trpc/crossover.world.buffEntity", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${INTERNAL_SERVICE_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                entity,
                level,
                hp,
                mp,
                st,
                ap,
                buffs,
                debuffs,
            }),
        })
    ).json();
    return result.data as Player | Monster;
}
