import {
    DUNGEON_MASTER_TOKEN,
    INTERNAL_SERVICE_KEY,
} from "$env/static/private";
import { login as loginCrossover, signup, stream } from "$lib/crossover/client";
import type {
    ItemEntity,
    Monster,
    MonsterEntity,
    Player,
    PlayerEntity,
} from "$lib/crossover/types";
import type { Abilities } from "$lib/crossover/world/abilities";
import { ArchetypesEnum } from "$lib/crossover/world/demographic";
import { resetEntityStats } from "$lib/crossover/world/entity";
import { type PlayerMetadata } from "$lib/crossover/world/player";
import { LOCATION_INSTANCE, MS_PER_TICK } from "$lib/crossover/world/settings";
import { actions } from "$lib/crossover/world/settings/actions";
import { compendium } from "$lib/crossover/world/settings/compendium";
import type { WorldAssetMetadata } from "$lib/crossover/world/types";
import { generateAvatarHash } from "$lib/server/crossover/avatar";
import {
    spawnItemAtGeohash,
    spawnMonster,
} from "$lib/server/crossover/dungeonMaster";
import { generateNPC } from "$lib/server/crossover/npc";
import { saveEntity } from "$lib/server/crossover/redis/utils";
import { npcs } from "$lib/server/crossover/settings/npc";
import { BUCKETS, ObjectStorage } from "$lib/server/objectStorage";
import { generateRandomSeed, sleep } from "$lib/utils";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { expect } from "vitest";
import type {
    ActionEvent,
    CTAEvent,
    FeedEvent,
    StreamEvent,
    UpdateEntitiesEvent,
} from "../../../src/routes/api/crossover/stream/+server";
import { createRandomUser, getRandomRegion } from "../../utils";

export type PerformAbilityTestResults =
    | "outOfRange"
    | "busy"
    | "insufficientResources"
    | "targetPredicateNotMet"
    | "itemConditionsNotMet"
    | "failure"
    | "success";

export const allActions = [
    actions.say,
    actions.look,
    actions.move,
    actions.take,
    actions.drop,
    actions.equip,
    actions.unequip,
    actions.create,
    actions.configure,
    actions.inventory,
    actions.rest,
    actions.enter,
    actions.trade,
    actions.writ,
    actions.fulfill,
    actions.learn,
    actions.give,
    actions.accept,
    actions.browse,
];

const testWorldAsset: WorldAssetMetadata = {
    height: 8,
    width: 4,
    tileheight: 128,
    tilewidth: 256,
    layers: [
        {
            data: [
                0, 0, 0, 0, 94, 94, 94, 0, 85, 85, 85, 0, 85, 85, 85, 0, 85, 85,
                85, 0, 95, 139, 95, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            ],
            height: 8,
            name: "platform",
            type: "tilelayer",
            width: 4,
            x: 0,
            y: 0,
        },
        // collider
        {
            data: [
                0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 74, 74, 0, 0, 74, 74, 0,
                0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            ],
            height: 8,
            name: "floor",
            offsetx: 0,
            offsety: -42.6820872917527,
            properties: [
                {
                    name: "traversableSpeed",
                    type: "float",
                    value: 0,
                },
                {
                    name: "interior",
                    type: "bool",
                    value: true,
                },
            ],
            type: "tilelayer",
            width: 4,
            x: 0,
            y: 0,
        },
        {
            data: [
                0, 0, 0, 0, 0, 0, 0, 0, 0, 218, 218, 0, 220, 0, 0, 0, 220, 0, 0,
                0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            ],
            height: 8,
            name: "wall_ne",
            offsetx: 12.010347376201,
            offsety: -37.1388500411984,
            properties: [
                {
                    name: "interior",
                    type: "bool",
                    value: true,
                },
            ],
            type: "tilelayer",
            width: 4,
            x: 0,
            y: 0,
        },
        {
            name: "pois",
            objects: [
                // Player Spawn Point
                {
                    point: true,
                    properties: [
                        {
                            name: "spawn",
                            type: "string",
                            value: "player",
                        },
                    ],
                    x: 619.114093959732,
                    y: 1764.77852348993,
                },
                // Item
                {
                    point: true,
                    properties: [
                        {
                            name: "prop",
                            type: "string",
                            value: "potionofhealth",
                        },
                    ],
                    x: 619.114093959732,
                    y: 1764.77852348993,
                },
                {
                    point: true,
                    properties: [
                        {
                            name: "prop",
                            type: "string",
                            value: "woodenclub",
                        },
                        {
                            name: "etching",
                            type: "string",
                            value: "well used",
                        },
                    ],
                    x: 619.114093959732,
                    y: 1764.77852348993,
                },
                // Item - spawn portal back to the actual world
                {
                    point: true,
                    properties: [
                        {
                            name: "prop",
                            type: "string",
                            value: "portal",
                        },
                        {
                            name: "target",
                            type: "string",
                            value: "{{source.item}}", // source is a special variable to be substituted when spawning worlds
                        },
                        {
                            name: "description",
                            type: "string",
                            value: "Tavern exit",
                        },
                    ],
                    x: 619.114093959732,
                    y: 1764.77852348993,
                },
                // Monster
                {
                    point: true,
                    properties: [
                        {
                            name: "beast",
                            type: "string",
                            value: "goblin",
                        },
                        {
                            name: "level",
                            type: "int",
                            value: 2,
                        },
                    ],
                    x: 619.114093959732,
                    y: 1764.77852348993,
                },
            ],
            type: "objectgroup",
            x: 0,
            y: 0,
        },
    ],
};

export async function createWorldAsset(): Promise<{
    url: string;
    asset: WorldAssetMetadata;
}> {
    const url = await ObjectStorage.putJSONObject({
        owner: null,
        name: "tilemaps/test_world_asset.json",
        data: testWorldAsset,
        bucket: BUCKETS.tiled,
    });

    return {
        url,
        asset: testWorldAsset,
    };
}

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
        demographic: {
            gender: "male",
            race: "human",
            archetype: ArchetypesEnum[0],
        },
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

    const { selector, texture, hash } = generateAvatarHash({
        demographic: playerMetadata.demographic,
        appearance: playerMetadata.appearance,
        textures: {},
    });

    const avatarFilename = `${hash}-${generateRandomSeed()}.png`;
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

export async function createNPCs({
    geohash,
    locationInstance,
}: {
    geohash?: string;
    locationInstance?: string;
}) {
    const blackSmith = await generateNPC(npcs.blacksmith.npc, {
        demographic: {},
        appearance: {},
        geohash,
        locationInstance,
    });
    const innKeeper = await generateNPC(npcs.innkeep.npc, {
        demographic: {},
        appearance: {},
        geohash,
        locationInstance,
    });
    const grocer = await generateNPC(npcs.grocer.npc, {
        demographic: {},
        appearance: {},
        geohash,
        locationInstance,
    });

    return {
        blackSmith,
        innKeeper,
        grocer,
    };
}

export async function createTestItems({
    owner,
    configOwner,
}: {
    geohash?: string;
    owner?: string;
    configOwner?: string;
}) {
    const woodenClub = await spawnItemAtGeohash({
        geohash: generateRandomGeohash(8, "h9"),
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        prop: compendium.woodenclub.prop,
        owner,
        configOwner,
    });

    const woodenClubTwo = await spawnItemAtGeohash({
        geohash: generateRandomGeohash(8, "h9"),
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        prop: compendium.woodenclub.prop,
        owner,
        configOwner,
    });

    const woodenClubThree = await spawnItemAtGeohash({
        geohash: generateRandomGeohash(8, "h9"),
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        prop: compendium.woodenclub.prop,
        owner,
        configOwner,
    });

    const potionOfHealth = (await spawnItemAtGeohash({
        geohash: generateRandomGeohash(8, "h9"),
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        prop: compendium.potionofhealth.prop,
        owner,
        configOwner,
    })) as ItemEntity;

    const woodenDoor = await spawnItemAtGeohash({
        geohash: generateRandomGeohash(8, "h9"),
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        prop: compendium.woodendoor.prop,
        owner,
        configOwner,
    });

    const portalOne = (await spawnItemAtGeohash({
        geohash: generateRandomGeohash(8, "h9"),
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        prop: compendium.portal.prop,
        variables: {
            [compendium.portal.variables!.description.variable]: "Portal One",
        },
        owner,
        configOwner,
    })) as ItemEntity;

    const portalTwo = (await spawnItemAtGeohash({
        geohash: generateRandomGeohash(8, "h9"),
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        prop: compendium.portal.prop,
        variables: {
            [compendium.portal.variables!.description.variable]: "Portal Two",
        },
        owner,
        configOwner,
    })) as ItemEntity;

    const portalThree = (await spawnItemAtGeohash({
        geohash: generateRandomGeohash(8, "h9"),
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        prop: compendium.portal.prop,
        variables: {
            [compendium.portal.variables!.description.variable]: "Portal Three",
        },
        owner,
        configOwner,
    })) as ItemEntity;

    const asset = await createWorldAsset();
    const worldAsset = asset.asset;
    const worldAssetUrl = asset.url;
    const tavern = (await spawnItemAtGeohash({
        geohash: generateRandomGeohash(8, "h9"),
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        prop: compendium.tavern.prop,
        variables: {
            url: worldAssetUrl,
        },
        owner,
        configOwner,
    })) as ItemEntity;

    return {
        potionOfHealth,
        woodenClub,
        woodenClubTwo,
        woodenClubThree,
        woodenDoor,
        portalOne,
        portalTwo,
        portalThree,
        tavern,
        worldAsset,
        worldAssetUrl,
    };
}

export async function createGoblinSpiderDragon(geohash?: string) {
    const region = String.fromCharCode(...getRandomRegion());
    geohash = geohash ?? generateRandomGeohash(8, "h9");

    const dragon = await spawnMonster({
        geohash: geohash,
        locationType: "geohash",
        beast: "dragon",
        locationInstance: LOCATION_INSTANCE,
    });

    const goblin = await spawnMonster({
        geohash: geohash,
        locationType: "geohash",
        beast: "goblin",
        locationInstance: LOCATION_INSTANCE,
    });

    const goblinTwo = await spawnMonster({
        geohash: geohash,
        locationType: "geohash",
        beast: "goblin",
        locationInstance: LOCATION_INSTANCE,
    });

    const goblinThree = await spawnMonster({
        geohash: geohash,
        locationType: "geohash",
        beast: "goblin",
        locationInstance: LOCATION_INSTANCE,
    });

    const giantSpider = await spawnMonster({
        geohash: geohash,
        locationType: "geohash",
        beast: "giantSpider",
        locationInstance: LOCATION_INSTANCE,
    });

    return {
        region,
        geohash,
        goblin,
        goblinTwo,
        goblinThree,
        giantSpider,
        dragon,
    };
}

export async function resetEntityResources(
    ...entities: (PlayerEntity | MonsterEntity)[]
) {
    for (const entity of entities) {
        resetEntityStats(entity);
        entity.lum = 0;
        entity.umb = 0;
        await saveEntity(entity);
    }
}

export async function createGandalfSarumanSauron() {
    const region = String.fromCharCode(...getRandomRegion());
    const geohash = generateRandomGeohash(8, "h9");
    let playerOne: Player;
    let playerTwo: Player;
    let playerThree: Player;
    let playerOneCookies: string;
    let playerTwoCookies: string;
    let playerThreeCookies: string;
    let playerOneStream: EventTarget;
    let playerTwoStream: EventTarget;
    let playerThreeStream: EventTarget;
    let playerOneWallet: NodeWallet;
    let playerTwoWallet: NodeWallet;
    let playerThreeWallet: NodeWallet;

    // Create players
    [playerOneWallet, playerOneCookies, playerOne] = await createRandomPlayer({
        region,
        geohash: geohash,
        name: "Gandalf",
    });
    [playerTwoWallet, playerTwoCookies, playerTwo] = await createRandomPlayer({
        region,
        geohash: geohash,
        name: "Saruman",
    });
    [playerThreeWallet, playerThreeCookies, playerThree] =
        await createRandomPlayer({
            region,
            geohash: geohash,
            name: "Sauron",
        });

    // Create stream
    [playerOneStream] = await stream({
        Cookie: playerOneCookies,
    });
    await expect(
        waitForEventData(playerOneStream, "feed"),
    ).resolves.toMatchObject({
        type: "system",
        message: "started",
    });

    [playerTwoStream] = await stream({
        Cookie: playerTwoCookies,
    });
    await expect(
        waitForEventData(playerTwoStream, "feed"),
    ).resolves.toMatchObject({
        type: "system",
        message: "started",
    });

    [playerThreeStream] = await stream({
        Cookie: playerThreeCookies,
    });
    await expect(
        waitForEventData(playerThreeStream, "feed"),
    ).resolves.toMatchObject({
        type: "system",
        message: "started",
    });

    return {
        region,
        geohash,
        playerOne: playerOne as PlayerEntity,
        playerTwo: playerTwo as PlayerEntity,
        playerThree: playerThree as PlayerEntity,
        playerOneCookies,
        playerTwoCookies,
        playerThreeCookies,
        playerOneStream,
        playerTwoStream,
        playerThreeStream,
        playerOneWallet,
        playerTwoWallet,
        playerThreeWallet,
    };
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

export async function waitForAnyEventData(
    eventTarget: EventTarget,
    duration = MS_PER_TICK * 4,
): Promise<{
    feed: FeedEvent | undefined;
    entities: UpdateEntitiesEvent | undefined;
    cta: CTAEvent | undefined;
    action: ActionEvent | undefined;
}> {
    var feed: FeedEvent | undefined = undefined;
    var entities: UpdateEntitiesEvent | undefined = undefined;
    var cta: CTAEvent | undefined = undefined;
    var action: ActionEvent | undefined = undefined;

    waitForEventData(eventTarget, "feed")
        .then((e) => (feed = e as FeedEvent))
        .catch(() => {});
    waitForEventData(eventTarget, "entities")
        .then((e) => (entities = e as UpdateEntitiesEvent))
        .catch(() => {});
    waitForEventData(eventTarget, "cta")
        .then((e) => (cta = e as CTAEvent))
        .catch(() => {});
    waitForEventData(eventTarget, "action")
        .then((e) => (action = e as ActionEvent))
        .catch(() => {});

    await sleep(duration);

    return {
        feed,
        entities,
        cta,
        action,
    };
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

export async function collectAllEventDataForDuration(
    eventTarget: EventTarget,
    duration = MS_PER_TICK * 4 * 2,
): Promise<{
    feed: FeedEvent[] | undefined;
    entities: UpdateEntitiesEvent[] | undefined;
    cta: CTAEvent[] | undefined;
    action: ActionEvent[] | undefined;
}> {
    var feed: FeedEvent[] | undefined = undefined;
    var entities: UpdateEntitiesEvent[] | undefined = undefined;
    var cta: CTAEvent[] | undefined = undefined;
    var action: ActionEvent[] | undefined = undefined;

    collectEventDataForDuration(eventTarget, "feed")
        .then((e) => (feed = e as FeedEvent[]))
        .catch(() => {});
    collectEventDataForDuration(eventTarget, "entities")
        .then((e) => (entities = e as UpdateEntitiesEvent[]))
        .catch(() => {});
    collectEventDataForDuration(eventTarget, "cta")
        .then((e) => (cta = e as CTAEvent[]))
        .catch(() => {});
    collectEventDataForDuration(eventTarget, "action")
        .then((e) => (action = e as ActionEvent[]))
        .catch(() => {});

    await sleep(duration);

    return {
        feed,
        entities,
        cta,
        action,
    };
}

export async function flushEventChannel(
    eventTarget: EventTarget,
    type: string,
) {
    await collectEventDataForDuration(eventTarget, type, MS_PER_TICK * 2);
}

export async function flushStream(
    eventTarget: EventTarget,
    duration = MS_PER_TICK * 4,
) {
    collectEventDataForDuration(eventTarget, "feed").catch(() => {});
    collectEventDataForDuration(eventTarget, "entities").catch(() => {});
    collectEventDataForDuration(eventTarget, "cta").catch(() => {});
    collectEventDataForDuration(eventTarget, "action").catch(() => {});
    await sleep(duration);
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

export async function performMonsterAbility(
    entity: string,
    target: string,
    ability: Abilities,
) {
    return fetch(
        "http://localhost:5173/trpc/crossover.dm.performMonsterAbility",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${DUNGEON_MASTER_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                entity,
                ability,
                target,
            }),
        },
    );
}
