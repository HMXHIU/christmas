import {
    PUBLIC_FEE_PAYER_PUBKEY,
    PUBLIC_RPC_ENDPOINT,
} from "$env/static/public";
import { AnchorClient } from "$lib/anchorClient";
import { PROGRAM_ID } from "$lib/anchorClient/defs";
import { autoCorrectGeohashPrecision } from "$lib/crossover/utils";
import type { Abilities } from "$lib/crossover/world/abilities";
import type { Actions } from "$lib/crossover/world/actions";
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
    substituteVariables,
} from "$lib/utils";
import { Keypair, PublicKey } from "@solana/web3.js";
import { loadPlayerEntity } from ".";
import { feePayerKeypair, hashObject } from "..";
import { getAvatars } from "../../../routes/api/crossover/avatar/[...path]/+server";
import { ObjectStorage } from "../objectStorage";
import { say } from "./actions";
import { dialogueRepository, playerRepository } from "./redis";
import type {
    DialogueEntity,
    Dialogues,
    GameEntity,
    Monster,
    Player,
    PlayerEntity,
} from "./redis/entities";
import { UserMetadataSchema } from "./router";
import { npcs } from "./settings/npc";
import { getUserMetadata, savePlayerState } from "./utils";

export {
    generateNPC,
    generateNPCMetadata,
    isEntityActualPlayer,
    isEntityNPC,
    npcRespondToAction,
    type NPC,
    type NPCs,
};

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

function dialogueVariables() {
    return {
        timeOfDay: "",
    };
}

/**
 * NPCs do not have websocket connections, this method should be hooked into the
 * player actions/abilities so that the npc can perform actions/abilities
 *
 * TODO:
 * Eventually when NPCs become autonomous agents, their logic can be run through websockets
 * and NPCs become programs in ICP with better intelligence
 */
async function npcRespondToAction({
    entity,
    target,
    action,
}: {
    entity: Player | Monster;
    target: Player; // the NPC
    action: Actions;
}) {
    if (target.npc) {
        const npc = target.npc.split("_")[0] as NPCs;
        const entityIsHuman = isEntityActualPlayer(entity);
        const tags = [`npc=${npc}`];

        // Respond to `say`
        if (action === "say") {
            // Search for greeting dialogue
            let dialogues = await searchDialogues("grt", tags);
            if (dialogues.length < 1) {
                // Search for ignore dialogue
                dialogues = await searchDialogues("ign", tags);
            }

            // Get best dialogue
            const dialogue = dialogues[0];

            if (dialogue && entityIsHuman) {
                const { msg, tgt } = dialogue;

                const message = substituteVariables(msg, {
                    self: target,
                    player: entity as Player,
                });

                const targetId = tgt
                    ? substituteVariables(tgt, {
                          self: target,
                          player: entity as Player,
                      })
                    : undefined;
                // Respond to target/surrounding players
                await say(target as PlayerEntity, message, {
                    target: targetId,
                    overwrite: true,
                });
            }
        }
    }
}

async function searchDialogues(
    dialogue: Dialogues,
    tags: string[],
): Promise<DialogueEntity[]> {
    console.log("searching", dialogue, tags);

    // Note: OR and MUST are mutually exclusive (choose either OR or MUST when defining the dialogue)
    let query = dialogueRepository
        .search()
        .where("dia")
        .equal(dialogue)
        .and("exc")
        .does.not.containsOneOf(...tags);

    // Check or condition
    let dialogues = (await query
        .and("or")
        .containsOneOf(...tags)
        .returnAll()) as DialogueEntity[];

    // Check must condition - 2 Step process (first get all relevant entries, then manually filter)
    if (dialogues.length < 1) {
        dialogues = (await tags
            .reduce((acc, c) => acc.or("mst").contains(c), query)
            .returnAll()) as DialogueEntity[];
        dialogues = dialogues.filter(
            (d) => d.mst && d.mst.every((t) => tags.includes(t)),
        );
    }

    return dialogues;
}

async function npcRespondToAbility({
    entity,
    target,
    ability,
}: {
    entity: Player | Monster;
    target: Player;
    ability: Abilities;
}) {
    if (target.npc) {
        const npc = target.npc.split("_")[0] as NPCs;
        const entityIsHuman = isEntityActualPlayer(entity);

        // Dialogues spoken directly to an actual player
        if (isEntityActualPlayer(entity)) {
        }
        // Dialogues spoken to all
        else {
        }
    }
}

function isEntityNPC(entity: GameEntity): boolean {
    if ("player" in entity && entity.npc) {
        return true;
    }
    return false;
}

function isEntityActualPlayer(entity: GameEntity): boolean {
    if ("player" in entity && !entity.npc) {
        return true;
    }
    return false;
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

    // Get instance
    const numInstances = await ObjectStorage.countObjects({
        owner: PUBLIC_FEE_PAYER_PUBKEY,
        bucket: "npc",
        prefix: npc,
    });
    const npcInstanceId = `${npc}_${numInstances}`;

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
    playerMetadata.npc = npcInstanceId; // store the npc instance id on MINIO

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

    // Store the secret keys in MINIO
    await ObjectStorage.putJSONObject({
        owner: PUBLIC_FEE_PAYER_PUBKEY,
        bucket: "npc",
        name: `${npc}/${playerId}`,
        data: {
            npc,
            instance: npcInstanceId,
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
