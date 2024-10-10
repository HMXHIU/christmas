import { PUBLIC_FEE_PAYER_PUBKEY } from "$env/static/public";
import {
    AgesEnum,
    BodyTypesEnum,
    EyeColorsEnum,
    EyeShapesEnum,
    FaceTypesEnum,
    HairColorsEnum,
    HairStylesEnum,
    PersonalitiesEnum,
    SkinTypesEnum,
    type Ages,
    type BodyTypes,
    type EyeColors,
    type EyeShapes,
    type FaceTypes,
    type HairColors,
    type HairStyles,
    type Personalities,
    type SkinTypes,
} from "$lib/crossover/world/appearance";
import {
    ArchetypesEnum,
    GendersEnum,
    RacesEnum,
    type Archetypes,
    type Genders,
    type Races,
} from "$lib/crossover/world/demographic";
import {
    PlayerMetadataSchema,
    type PlayerAppearance,
    type PlayerDemographic,
    type PlayerMetadata,
} from "$lib/crossover/world/player";
import type { LocationType } from "$lib/crossover/world/types";
import type { PlayerEntity } from "$lib/server/crossover/types";
import {
    generatePin,
    sampleFrom,
    stringToRandomNumber,
} from "$lib/utils/random";
import { Keypair } from "@solana/web3.js";
import { loadPlayerEntity } from "..";
import type {
    CTAEvent,
    FeedEvent,
} from "../../../../routes/api/crossover/stream/+server";
import { ObjectStorage } from "../../objectStorage";
import { getOrCreatePlayer, savePlayerState } from "../../user";
import { getAvatars } from "../avatar";
import {
    verifyP2PTransaction,
    type P2PGiveTransaction,
    type P2PLearnTransaction,
    type P2PTradeTransaction,
} from "../player";
import { saveEntity } from "../redis/utils";
import { npcs } from "../settings/npc";
import {
    npcRespondToGive,
    npcRespondToGreet,
    npcRespondToLearn,
    npcRespondToMessage,
    npcRespondToTrade,
} from "./actions";
import type { NPC, NPCs } from "./types";

export { createNPCMetadata, npcRespondToEvent, spawnNPC };

async function npcRespondToEvent(
    event: CTAEvent | FeedEvent,
    npc: string, // This must be an NPC publicKey
) {
    // Feed events
    if (event.event === "feed" && event.type === "message" && event.variables) {
        // Say/Greet
        if (event.variables.cmd === "say") {
            let { message, player, target } = event.variables;
            message = (message as string).trim();
            // NPCs only respond to targeted greet/say
            if (player && target === npc) {
                // Greet is just a say with no message
                if (message === "") {
                    await npcRespondToGreet(npc, player as string);
                } else {
                    await npcRespondToMessage(npc, player as string, message);
                }
            }
        }
    }
    // CTA events
    if (event.event === "cta") {
        const { token, pin } = (event as CTAEvent).cta;
        const p2pTx = await verifyP2PTransaction(token);
        // Give - will take any item given to it
        if (
            p2pTx.transaction === "give" &&
            (p2pTx as P2PGiveTransaction).receiver === npc
        ) {
            await npcRespondToGive(npc, p2pTx as P2PGiveTransaction);
        }
        // Teach - will always teach
        else if (
            p2pTx.transaction === "learn" &&
            (p2pTx as P2PLearnTransaction).teacher === npc
        ) {
            await npcRespondToLearn(npc, p2pTx as P2PLearnTransaction);
        }
        // Trade - redirect player to browse your wares
        else if (
            p2pTx.transaction === "trade" &&
            (p2pTx as P2PTradeTransaction).seller === npc
        ) {
            await npcRespondToTrade(npc, p2pTx as P2PTradeTransaction);
        }
    }
}

async function spawnNPC(
    npc: NPCs,
    options: {
        name?: string;
        description?: string;
        geohash?: string;
        locationInstance?: string;
        locationType?: LocationType;
        demographic: Partial<PlayerDemographic>;
        appearance: Partial<PlayerAppearance>;
        uniqueSuffix?: string;
    },
): Promise<PlayerEntity> {
    // Generate the npc id
    const npcCount = await ObjectStorage.countObjects({
        owner: PUBLIC_FEE_PAYER_PUBKEY,
        bucket: "npc",
        prefix: npc,
    });
    const suffix = options?.uniqueSuffix ?? `${npcCount}${generatePin(4)}`; // prevent race condition by generating additional pin
    const npcId = `${npc}/${suffix}`; // `npcId` is used for identifying the npc not the it's public key

    // Default location for NPCs is in its own world in limbo
    const locationInstance = options.locationInstance ?? npcId;
    const locationType = options.locationType ?? "limbo";
    const geohash = options.geohash ?? npcId;

    // Generate and validate NPC player metadata
    let playerMetadata = await PlayerMetadataSchema.parse(
        await createNPCMetadata({
            player: npcId,
            demographic: options.demographic,
            appearance: options.appearance,
            npc: npcs[npc],
            name: options.name,
            description: options.description,
        }),
    );
    playerMetadata.npc = npcId; // store the npc instance id on MINIO

    // Create player
    playerMetadata = await getOrCreatePlayer(npcId, playerMetadata);

    // Store the keypair for npc in MINIO
    if (
        await !ObjectStorage.objectExists({
            bucket: "npc",
            name: npcId,
            owner: PUBLIC_FEE_PAYER_PUBKEY,
        })
    ) {
        const keypair = Keypair.generate();
        await ObjectStorage.putJSONObject({
            owner: PUBLIC_FEE_PAYER_PUBKEY, // owned by the program (who can access all the NPCs private keys if needed)
            bucket: "npc",
            name: npcId,
            data: {
                npc,
                instance: npcId,
                publicKey: keypair.publicKey.toString(),
                secretKey: keypair.secretKey,
            },
        });
    }

    // Get or load player entity
    let player = await loadPlayerEntity(npcId, {
        geohash,
        region: "@@@", // special region reserved for NPCs,
        loggedIn: true,
        locationInstance,
        locationType,
    });

    // Save player state & entity
    player = await saveEntity(player);
    await savePlayerState(npcId); // must save after player entity

    return player;
}

async function createNPCMetadata({
    player,
    demographic,
    appearance,
    name,
    description,
    npc,
    avatar,
}: {
    npc: NPC;
    player: string;
    name?: string;
    description?: string;
    demographic: Partial<PlayerDemographic>;
    appearance: Partial<PlayerAppearance>;
    avatar?: string;
}): Promise<PlayerMetadata> {
    name = name ?? npc.nameTemplate;
    description = description ?? npc.descriptionTemplate;
    let seed = stringToRandomNumber(player);

    // Randomize demographic
    demographic.race =
        demographic.race ?? sampleFrom<Races>([...RacesEnum], 1, seed++)[0];
    demographic.gender =
        demographic.gender ??
        sampleFrom<Genders>([...GendersEnum], 1, seed++)[0];
    demographic.archetype =
        demographic.archetype ??
        sampleFrom<Archetypes>([...ArchetypesEnum], 1, seed++)[0];

    // Randomize appearance
    appearance.age =
        appearance.age ?? sampleFrom<Ages>([...AgesEnum], 1, seed++)[0];
    appearance.body =
        appearance.body ??
        sampleFrom<BodyTypes>([...BodyTypesEnum], 1, seed++)[0];
    appearance.eye = {
        type:
            appearance.eye?.type ??
            sampleFrom<EyeShapes>([...EyeShapesEnum], 1, seed++)[0],
        color:
            appearance.eye?.color ??
            sampleFrom<EyeColors>([...EyeColorsEnum], 1, seed++)[0],
    };
    appearance.face =
        appearance.face ??
        sampleFrom<FaceTypes>([...FaceTypesEnum], 1, seed++)[0];
    appearance.hair = {
        type:
            appearance.hair?.type ??
            sampleFrom<HairStyles>([...HairStylesEnum], 1, seed++)[0],
        color:
            appearance.hair?.color ??
            sampleFrom<HairColors>([...HairColorsEnum], 1, seed++)[0],
    };
    appearance.personality = appearance.personality =
        appearance.personality ??
        sampleFrom<Personalities>([...PersonalitiesEnum], 1, seed++)[0];
    appearance.skin =
        appearance.skin ??
        sampleFrom<SkinTypes>([...SkinTypesEnum], 1, seed++)[0];

    // Get avatar
    if (!avatar) {
        const avatars = await getAvatars({
            demographic: demographic as PlayerDemographic,
            appearance: appearance as PlayerAppearance,
        });
        avatar = sampleFrom(avatars, 1, seed++)[0];
    }

    return {
        player,
        name,
        avatar,
        description,
        demographic: demographic as PlayerDemographic,
        appearance: appearance as PlayerAppearance,
    };
}
