import {
    PUBLIC_FEE_PAYER_PUBKEY,
    PUBLIC_RPC_ENDPOINT,
} from "$env/static/public";
import { AnchorClient } from "$lib/anchorClient";
import { PROGRAM_ID } from "$lib/anchorClient/defs";
import { autoCorrectGeohashPrecision } from "$lib/crossover/utils";
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
import { worldSeed } from "$lib/crossover/world/settings/world";
import type { AssetMetadata } from "$lib/crossover/world/types";
import {
    sampleFrom,
    stringToRandomNumber,
    stringToUint8Array,
} from "$lib/utils";
import { Keypair, PublicKey } from "@solana/web3.js";
import { loadPlayerEntity } from ".";
import { feePayerKeypair, hashObject } from "..";
import { getAvatars } from "../../../routes/api/crossover/avatar/[...path]/+server";
import { ObjectStorage } from "../objectStorage";
import { playerRepository } from "./redis";
import type { PlayerEntity } from "./redis/entities";
import { UserMetadataSchema } from "./router";
import { getUserMetadata, savePlayerState } from "./utils";

export { generateNPC, generateNPCMetadata, npcs };

/**
 * `NPC` is a template used to create an NPC `player` instance
 */

type NPCs = "innkeep" | "grocer" | "blacksmith" | "alchemist";

interface NPC {
    npc: NPCs;
    nameTemplate: string;
    descriptionTemplate: string;
    asset: AssetMetadata;
}

const npcs: Record<NPCs, NPC> = {
    innkeep: {
        npc: "innkeep",
        nameTemplate: "Inn Keeper",
        descriptionTemplate:
            "The innkeeper tends to the inn with efficiency, offering food, drink, and a place to rest for travelers. Always attentive to guests, they know much about the town and its visitors",
        asset: {
            path: "",
        },
    },
    grocer: {
        npc: "grocer",
        nameTemplate: "Grocer",
        descriptionTemplate:
            "The grocer diligently organizes shelves and manages the shop with care. Always ready to assist customers, they have a keen knowledge of local produce and supplies, offering fair deals to all who pass through",
        asset: {
            path: "",
        },
    },
    blacksmith: {
        npc: "blacksmith",
        nameTemplate: "Blacksmith",
        descriptionTemplate:
            "The blacksmith works steadily at the forge, crafting and repairing weapons and tools with precision. Known for their skill and reliability, they provide essential services to adventurers and townsfolk alike",
        asset: {
            path: "",
        },
    },
    alchemist: {
        npc: "alchemist",
        nameTemplate: "Alchemist",
        descriptionTemplate:
            "The alchemist carefully mixes potions and brews, always experimenting with new concoctions. Knowledgeable in herbs and mystical ingredients, they offer remedies and rare elixirs to those seeking both healing and power.",
        asset: {
            path: "",
        },
    },
};

async function generateNPCMetadata({
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

async function generateNPC(
    npc: NPCs,
    options: {
        name?: string;
        description?: string;
        demographic: Partial<PlayerDemographic>;
        appearance: Partial<PlayerAppearance>;
    },
): Promise<PlayerEntity> {
    // Generate keys (store private keys in MINIO)
    const keypair = Keypair.generate();
    const playerId = keypair.publicKey.toString();
    const region = "@@@"; // special region reserved for NPCs
    const locationInstance = playerId; // spawn initially in its own world
    const geohash = autoCorrectGeohashPrecision(
        "w2",
        worldSeed.spatial.unit.precision,
    );

    // Get fee payer anchor client
    const anchorClient = new AnchorClient({
        programId: new PublicKey(PROGRAM_ID),
        keypair: feePayerKeypair,
        cluster: PUBLIC_RPC_ENDPOINT,
    });

    // Generate and validate NPC player metadata
    const playerMetadata = await PlayerMetadataSchema.parse(
        await generateNPCMetadata({
            player: playerId,
            demographic: options.demographic,
            appearance: options.appearance,
            npc: npcs[npc],
            name: options.name,
            description: options.description,
        }),
    );

    // Create user account
    let userMetadataUrl = await ObjectStorage.putJSONObject(
        {
            owner: null,
            bucket: "user",
            name: hashObject(["user", playerId]),
            data: UserMetadataSchema.parse({
                publicKey: playerId,
            }),
        },
        { "Content-Type": "application/json" },
    );
    await anchorClient.createUser({
        region: Array.from(stringToUint8Array(region)),
        uri: userMetadataUrl,
        wallet: keypair.publicKey,
        signers: [keypair],
    });

    // Get user metadata
    let userMetadata = await getUserMetadata(playerId);

    // Check if player metadata (userMetadata.crossover) already exists (should not be since we generate a new key pair)
    if (userMetadata?.crossover != null) {
        throw new Error(`Player ${playerId} already exists (storage)`);
    }

    // Update user metadata with player metadata
    userMetadata = await UserMetadataSchema.parse({
        ...userMetadata,
        crossover: playerMetadata,
    });

    // Store new user metadata and get url
    userMetadataUrl = await ObjectStorage.putJSONObject({
        bucket: "user",
        owner: null,
        data: userMetadata,
        name: hashObject(["user", playerId]),
    });

    // Update account with metadata uri
    await anchorClient.updateUser({
        region: Array.from(stringToUint8Array(region)),
        uri: userMetadataUrl,
        wallet: keypair.publicKey,
        signers: [keypair],
    });

    // Get instance
    const numInstances = await ObjectStorage.countObjects({
        owner: PUBLIC_FEE_PAYER_PUBKEY,
        bucket: "npc",
        prefix: npc,
    });
    const instanceId = `${npc}_${numInstances}`;

    // Store the secret keys in MINIO
    const url = await ObjectStorage.putJSONObject({
        owner: PUBLIC_FEE_PAYER_PUBKEY,
        bucket: "npc",
        name: `${npc}/${playerId}`,
        data: {
            npc,
            instance: instanceId,
            publicKey: playerId,
            secretKey: keypair.secretKey,
        },
    });

    // Get or load player entity
    let player = await loadPlayerEntity(playerId, {
        geohash,
        region,
        loggedIn: true,
        locationInstance: locationInstance,
    });

    // Save player state & entity
    player = (await playerRepository.save(playerId, player)) as PlayerEntity;
    await savePlayerState(playerId); // must save after player entity

    return player;
}
