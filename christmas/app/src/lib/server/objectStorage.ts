import { Client } from "minio";

import {
    PUBLIC_MINIO_ENDPOINT,
    PUBLIC_MINIO_PORT,
    PUBLIC_MINIO_USE_SSL,
    PUBLIC_MINIO_ACCESS_KEY,
    PUBLIC_MINIO_SECRET_KEY,
} from "$env/static/public";
import type { Readable } from "stream";

export { BUCKETS, ObjectStorage };

const endPoint = PUBLIC_MINIO_ENDPOINT;
const port = parseInt(PUBLIC_MINIO_PORT);
const useSSL = JSON.parse(PUBLIC_MINIO_USE_SSL);
const accessKey = PUBLIC_MINIO_ACCESS_KEY;
const secretKey = PUBLIC_MINIO_SECRET_KEY;

const client = new Client({
    endPoint,
    port,
    useSSL,
    accessKey,
    secretKey,
});

const BUCKETS = {
    user: "user",
};

// Initialize buckets
initializeBuckets();

/**
 * Do not expose this to client (only backend)
 * All operations should be done through ObjectStorage (with permission checks)
 */
class ObjectStorage {
    /**
     * If owner is null, the object is public else private
     */
    static async putObject({
        owner,
        bucket,
        name,
        data,
    }: {
        owner: string | null;
        bucket: string;
        name: string;
        data: object;
    }) {
        const prefix = owner ? "private" : "public";

        if (owner && name !== owner) {
            throw new Error(
                `Permission denied: ${bucket} ${owner} does not own ${name}`,
            );
        }

        await client.putObject(
            bucket,
            `${prefix}/${name}`,
            JSON.stringify(data),
        );
    }

    static async getObject({
        owner,
        bucket,
        name,
    }: {
        owner: string | null;
        bucket: string;
        name: string;
    }): Promise<Readable> {
        const prefix = owner ? "private" : "public";

        if (owner && name !== owner) {
            throw new Error(
                `Permission denied: ${bucket} ${owner} does not own ${name}`,
            );
        }

        return await client.getObject(bucket, `${prefix}/${name}`);
    }

    static objectUrl(bucket: string, name: string): string {
        const objectUrl =
            (useSSL ? "https://" : "http://") +
            endPoint +
            ":" +
            port +
            "/" +
            bucket +
            "/" +
            name;
        return objectUrl;
    }

    static async objectExists({
        bucket,
        name,
        owner,
    }: {
        bucket: string;
        name: string;
        owner: string | null;
    }): Promise<boolean> {
        const prefix = owner ? "private" : "public";
        if (owner && name !== owner) {
            throw new Error(
                `Permission denied: ${bucket} ${owner} does not own ${name}`,
            );
        }
        try {
            await client.statObject(bucket, `${prefix}/${name}`);
            return true;
        } catch (error) {
            return false;
        }
    }
}

function initializeBuckets() {
    for (const bucket of Object.values(BUCKETS)) {
        client.bucketExists(bucket, (error, exists) => {
            if (error) {
                console.error(`Error creating bucket ${bucket}: ${error}`);
            } else if (!exists) {
                client.makeBucket(bucket, (error) => {
                    if (error) {
                        throw error;
                    }
                });
            } else {
                console.log(`Bucket ${bucket} already exists`);
            }
        });
    }
}
