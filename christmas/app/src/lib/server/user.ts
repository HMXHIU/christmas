import {
    MemberMetadataSchema,
    type MemberMetadata,
} from "$lib/community/types";
import {
    PlayerMetadataSchema,
    type PlayerMetadata,
} from "$lib/crossover/world/player";
import { parseZodErrors } from "$lib/utils";
import { UserMetadataSchema, type UserMetadata } from "$lib/utils/user";
import { z } from "zod";
import { PlayerStateSchema, type PlayerState } from "./crossover";
import { playerRepository } from "./crossover/redis";
import { ObjectStorage } from "./objectStorage";

export {
    getOrCreateMember,
    getOrCreatePlayer,
    getOrCreateUser,
    getPlayerState,
    getUser,
    savePlayerState,
    setPlayerState,
};

async function getOrCreateUser(publicKey: string): Promise<UserMetadata> {
    const userExists = await ObjectStorage.objectExists({
        bucket: "user",
        name: publicKey,
        owner: publicKey,
    });
    if (!userExists) {
        // Update user metadata with player metadata
        const userMetadata = UserMetadataSchema.parse({
            publicKey: publicKey,
        });

        // Initialize user
        await ObjectStorage.putJSONObject({
            bucket: "user",
            owner: publicKey,
            name: publicKey,
            data: userMetadata,
        });

        return userMetadata;
    }

    return UserMetadataSchema.parse(
        await ObjectStorage.getJSONObject({
            bucket: "user",
            name: publicKey,
            owner: publicKey,
        }),
    );
}

async function getUser(publicKey: string): Promise<UserMetadata> {
    const userExists = await ObjectStorage.objectExists({
        bucket: "user",
        name: publicKey,
        owner: publicKey,
    });

    if (!userExists) {
        throw new Error(`User ${publicKey} does not exists`);
    }

    return UserMetadataSchema.parse(
        await ObjectStorage.getJSONObject({
            bucket: "user",
            name: publicKey,
            owner: publicKey,
        }),
    );
}

async function getOrCreatePlayer(
    publicKey: string,
    playerMetadata: PlayerMetadata,
): Promise<PlayerMetadata> {
    const userMetadata = await getOrCreateUser(publicKey);

    if (userMetadata.crossover) {
        return PlayerMetadataSchema.parse(userMetadata.crossover);
    } else {
        // Parse & validate player metadata
        playerMetadata = PlayerMetadataSchema.parse(playerMetadata);

        // Check that avatar exists
        const { demographic, appearance, avatar } = playerMetadata;
        const avatarFileName = avatar.split("/").slice(-1)[0];
        if (
            !(await ObjectStorage.objectExists({
                owner: null,
                bucket: "avatar",
                name: avatarFileName,
            }))
        ) {
            throw new Error(`Avatar for ${publicKey} does not exist`);
        }

        // Update player Metadata
        userMetadata.crossover = playerMetadata;
        await ObjectStorage.putJSONObject({
            bucket: "user",
            owner: publicKey,
            name: publicKey,
            data: userMetadata,
        });
        return playerMetadata;
    }
}

async function getOrCreateMember(
    publicKey: string,
    memberMetadata: MemberMetadata,
): Promise<MemberMetadata> {
    const userMetadata = await getOrCreateUser(publicKey);

    if (userMetadata.community) {
        return MemberMetadataSchema.parse(userMetadata.community);
    } else {
        // Parse & validate member metadata
        memberMetadata = MemberMetadataSchema.parse(memberMetadata);

        // Update member Metadata
        userMetadata.community = memberMetadata;
        await ObjectStorage.putJSONObject({
            bucket: "user",
            owner: publicKey,
            name: publicKey,
            data: userMetadata,
        });
        return memberMetadata;
    }
}

/**
 * Retrieves the player state for a given public key.
 *
 * @param publicKey The public key of the player.
 * @returns A promise that resolves to the player state or null if not found.
 */
async function getPlayerState(publicKey: string): Promise<PlayerState | null> {
    try {
        return await ObjectStorage.getJSONObject({
            owner: publicKey,
            bucket: "player",
            name: publicKey,
        });
    } catch (error: any) {
        return null;
    }
}

/**
 * Sets the player state for a given public key.
 *
 * @param publicKey The public key of the player.
 * @param state The player state to set.
 * @returns A promise that resolves to a string indicating the success of the operation.
 * @throws Error if there is an error parsing the player state.
 */
async function setPlayerState(
    publicKey: string,
    state: PlayerState,
): Promise<string> {
    try {
        return await ObjectStorage.putJSONObject({
            owner: publicKey,
            bucket: "player",
            name: publicKey,
            data: PlayerStateSchema.parse(state),
        });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            throw new Error(JSON.stringify(parseZodErrors(error)));
        } else {
            throw error;
        }
    }
}

/**
 * Saves the player state (from redis into s3) for a given public key.
 *
 * @param publicKey The public key of the player.
 * @returns A promise that resolves to a string indicating the success of the operation.
 */
async function savePlayerState(publicKey: string): Promise<string> {
    return await setPlayerState(
        publicKey,
        (await playerRepository.fetch(publicKey)) as PlayerState,
    );
}
