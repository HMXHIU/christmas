import { NFTStorage, File } from "nft.storage";
import { kebabCase } from "lodash";
import { Client as MinioClient } from "minio";

import { createHash } from "crypto";
import { promisify } from "util";

export enum NFTStorageClientType {
    NFT_STORAGE,
    MINIO, // USE MINIO FOR LOCAL DEVELOPMENT ONLY (PUBLIC WITH NO ACLS)
}

export class NFTStorageClient {
    client: NFTStorage | MinioClient;
    clientType: NFTStorageClientType;
    bucket: string;
    useSSL: boolean;
    port: number;
    endPoint: string;

    constructor({
        clientType,
        token,
        accessKey,
        secretKey,
        endPoint,
        port,
        useSSL,
        bucket,
    }: {
        clientType: NFTStorageClientType;
        token?: string;
        accessKey?: string;
        secretKey?: string;
        endPoint?: string;
        port?: number;
        useSSL?: boolean;
        bucket?: string;
    }) {
        if (clientType === NFTStorageClientType.NFT_STORAGE) {
            this.client = new NFTStorage({ token: token });
        } else {
            this.bucket = bucket;
            this.clientType = clientType;
            this.useSSL = useSSL;
            this.port = port;
            this.endPoint = endPoint;
            this.client = new MinioClient({
                endPoint,
                port,
                useSSL,
                accessKey,
                secretKey,
            });
        }
    }

    async store({
        name,
        description,
        imageFile,
        additionalMetadata,
    }: {
        name: string;
        description: string;
        imageFile: File;
        additionalMetadata?: any;
    }): Promise<string> {
        const slugifiedName = kebabCase(name);

        // NFTStorage
        if (this.clientType === NFTStorageClientType.NFT_STORAGE) {
            // get data from file
            const blob = new Blob([imageFile], { type: imageFile.type });
            const metadata = await (this.client as NFTStorage).store({
                name: name,
                description: description,
                // TODO: change extension based on type
                image: new File([blob], `${slugifiedName}.jpg`, {
                    type: imageFile.type,
                }),
                ...(additionalMetadata || {}),
            });
            return metadata.url;
        }
        // MINIO
        else {
            const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
            const imageHash = createHash("sha256")
                .update(imageBuffer)
                .digest("hex");
            const imageUrl = this.objectUrl(imageHash);

            // Get or upload image
            if (!(await this.objectExists(imageHash))) {
                const objInfo = await (this.client as MinioClient).putObject(
                    this.bucket,
                    imageHash,
                    imageBuffer
                );
                console.log("Uploaded image", objInfo);
            }

            // Save metadata
            const metadata = {
                name: name,
                description: description,
                image: imageUrl,
                ...(additionalMetadata || {}),
            };
            const metadataHash = createHash("sha256")
                .update(JSON.stringify(metadata))
                .digest("hex");
            const metadataUrl = this.objectUrl(metadataHash);

            // Get or upload metadata
            if (!(await this.objectExists(metadataHash))) {
                const objInfo = await (this.client as MinioClient).putObject(
                    this.bucket,
                    metadataHash,
                    Buffer.from(JSON.stringify(metadata), "utf8")
                );
                console.log("Uploaded metadata", objInfo);
            }
            return metadataUrl;
        }
    }

    objectUrl(name: string): string {
        const objectUrl =
            (this.useSSL ? "https://" : "http://") +
            this.endPoint +
            ":" +
            this.port +
            "/" +
            this.bucket +
            "/" +
            name;
        return objectUrl;
    }

    async objectExists(name: string): Promise<boolean> {
        try {
            // Use statObject to check if the object exists and get its metadata
            const stats = await (this.client as MinioClient).statObject(
                this.bucket,
                name
            );
            return true;
        } catch (error) {
            // Handle the error if the object doesn't exist
            if (error.code === "NotFound") {
                console.log("Object not found.");
            } else {
                console.error("Error checking object existence:", error);
            }
            return false;
        }
    }
}
