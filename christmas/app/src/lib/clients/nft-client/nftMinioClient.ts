import { Client as MinioClient } from "minio";

import { createHash } from "crypto";

export class NFTMinioClient {
    bucket: string;
    useSSL: boolean;
    port: number;
    endPoint: string;
    client: MinioClient;

    constructor({
        accessKey,
        secretKey,
        endPoint,
        port,
        useSSL,
        bucket,
    }: {
        accessKey: string;
        secretKey: string;
        endPoint: string;
        port: number;
        useSSL: boolean;
        bucket: string;
    }) {
        this.bucket = bucket;
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

    async store({
        name,
        description,
        imageFile,
        imageUrl,
        additionalMetadata,
    }: {
        name: string;
        description?: string | null;
        imageFile?: File | null;
        imageUrl?: string | null;
        additionalMetadata?: any;
    }): Promise<string> {
        // use imageFile if there is else fallback on imageUrl
        if (imageFile != null) {
            const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
            const imageHash = createHash("sha256")
                .update(imageBuffer)
                .digest("hex");
            imageUrl = this.objectUrl(imageHash);

            // Get or upload image
            if (!(await this.objectExists(imageHash))) {
                const objInfo = await this.client.putObject(
                    this.bucket,
                    imageHash,
                    imageBuffer,
                );
                console.log("Uploaded image", objInfo);
            }
        }

        // Save metadata
        const metadata = {
            name: name,
            ...(description && { description }),
            ...(imageUrl && { image: imageUrl }),
            ...(additionalMetadata || {}),
        };
        const metadataHash = createHash("sha256")
            .update(JSON.stringify(metadata))
            .digest("hex");
        const metadataUrl = this.objectUrl(metadataHash);

        // Get or upload metadata
        if (!(await this.objectExists(metadataHash))) {
            const objInfo = await this.client.putObject(
                this.bucket,
                metadataHash,
                Buffer.from(JSON.stringify(metadata), "utf8"),
            );
            console.log("Uploaded metadata", objInfo);
        }
        return metadataUrl;
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
            const stats = await this.client.statObject(this.bucket, name);
            return true;
        } catch (error: any) {
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
