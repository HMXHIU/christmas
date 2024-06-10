import { Client, type BucketItem } from "minio";

import {
    MINIO_ACCESS_KEY,
    MINIO_ENDPOINT,
    MINIO_PORT,
    MINIO_SECRET_KEY,
    MINIO_USE_SSL,
} from "$env/static/private";
import { PUBLIC_HOST } from "$env/static/public";
import type { Readable } from "stream";

export { BUCKETS, ObjectStorage };

const endPoint = MINIO_ENDPOINT;
const port = parseInt(MINIO_PORT);
const useSSL = JSON.parse(MINIO_USE_SSL);
const accessKey = MINIO_ACCESS_KEY;
const secretKey = MINIO_SECRET_KEY;

const client = new Client({
    endPoint,
    port,
    useSSL,
    accessKey,
    secretKey,
});

const BUCKETS = {
    user: "user",
    coupon: "coupon",
    store: "store",
    image: "image",
    player: "player",
    avatar: "avatar",
};

// Initialize buckets
initializeBuckets();

/**
 * ObjectStorage
 *
 * - Do not expose this to client (only backend)
 * - All operations should be done through ObjectStorage (with permission checks)
 * - If owner is null, the object is public else private
 */
class ObjectStorage {
    /**
     * Put object
     *
     * - Caller must ensure that the owner has permission to access the object
     */
    static async putObject(
        {
            owner,
            bucket,
            name,
            data,
        }: {
            owner: string | null;
            bucket: string;
            name: string;
            data: string | Buffer | Readable;
        },
        metaData?: Record<string, string>,
    ): Promise<string> {
        const prefix = owner ? "private" : "public";

        // Check valid bucket
        if (!Object.values(BUCKETS).includes(bucket)) {
            throw new Error(`Invalid bucket: ${bucket}`);
        }

        // Upload object
        await client.putObject(bucket, `${prefix}/${name}`, data, metaData);

        // Tag private objects
        if (owner != null) {
            await client.setObjectTagging(bucket, `${prefix}/${name}`, {
                owner,
            });
        }

        return this.objectUrl({ owner, bucket, name });
    }

    static async putJSONObject(
        {
            owner,
            bucket,
            name,
            data,
        }: {
            owner: string | null;
            bucket: string;
            name: string;
            data: object;
        },
        metaData?: Record<string, string>,
    ): Promise<string> {
        return this.putObject(
            {
                owner,
                bucket,
                name,
                data: JSON.stringify(data),
            },
            { "Content-Type": "application/json", ...metaData },
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

        // Check valid bucket
        if (!Object.values(BUCKETS).includes(bucket)) {
            throw new Error(`Invalid bucket: ${bucket}`);
        }

        // Check object owner if private
        if (owner != null) {
            let ownerTag = await getObjectTag(
                bucket,
                `${prefix}/${name}`,
                "owner",
            );

            if (ownerTag == null) {
                throw new Error(
                    `Private object ${bucket}/${prefix}/${name} missing owner tag`,
                );
            }

            if (ownerTag !== owner) {
                throw new Error(
                    `Permission denied: ${owner} does not own ${bucket}/${prefix}/${name}`,
                );
            }
        }

        return await client.getObject(bucket, `${prefix}/${name}`);
    }

    static async getJSONObject({
        owner,
        bucket,
        name,
    }: {
        owner: string | null;
        bucket: string;
        name: string;
    }): Promise<object> {
        const readable = await this.getObject({ owner, bucket, name });
        return JSON.parse(await readable.read());
    }

    static async listObjects({
        owner,
        bucket,
        maxKeys,
        prefix,
        recursive,
    }: {
        owner: string | null;
        bucket: string;
        maxKeys?: number;
        prefix?: string;
        recursive?: boolean;
    }): Promise<BucketItem[]> {
        const acl = owner ? "private" : "public";
        prefix = prefix ? `${acl}/${prefix}` : `${acl}/`;
        maxKeys = maxKeys || 10;

        // Check valid bucket
        if (!Object.values(BUCKETS).includes(bucket)) {
            throw new Error(`Invalid bucket: ${bucket}`);
        }

        const getBucketObjects = new Promise<BucketItem[]>(
            (resolve, reject) => {
                const stream = client.listObjectsV2(
                    bucket,
                    prefix,
                    recursive ?? false,
                );
                let count = 0;
                let bucketItems: BucketItem[] = [];

                stream.on("data", function (obj) {
                    if (count < maxKeys) {
                        bucketItems.push(obj);
                        count++;
                    } else {
                        stream.emit("end");
                    }
                });

                stream.on("error", function (err) {
                    reject(err);
                });

                stream.on("end", function () {
                    resolve(bucketItems);
                });
            },
        );

        return getBucketObjects;
    }

    static objectUrl({
        bucket,
        name,
        owner,
    }: {
        bucket: string;
        name: string;
        owner: string | null;
    }): string {
        const prefix = owner ? "private" : "public";
        return `${PUBLIC_HOST}/api/storage/${bucket}/${prefix}/${name}`;
    }

    static async redirectObjectUrl({
        bucket,
        name,
        owner,
    }: {
        bucket: string;
        name: string;
        owner: string | null;
    }): Promise<string> {
        const prefix = owner ? "private" : "public";

        return await client.presignedUrl(
            "GET",
            bucket,
            `${prefix}/${name}`,
            24 * 60 * 60,
        );
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
                `Permission denied: ${owner} does not own ${bucket}/${prefix}/${name}`,
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

async function getObjectTag(
    bucket: string,
    name: string,
    key: string,
): Promise<string | null> {
    // Get object tags
    const tags = await client.getObjectTagging(bucket, name);

    for (const tag of tags) {
        if (tag.Key === key) {
            return tag.Value;
        }
    }
    return null;
}
