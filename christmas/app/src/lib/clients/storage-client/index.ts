import type {
    CouponMetadata,
    StoreMetadata,
    UserMetadata,
} from "../anchor-client/types";

export class StorageClient {
    static async uploadImage(imageFile: File, options?: { private?: boolean }) {
        const imageBuffer = Buffer.from(await imageFile.arrayBuffer());

        const acl = options?.private ? "private" : "public"; // defaults to public

        const response = await fetch(`/api/storage/image/${acl}`, {
            method: "POST",
            headers: {
                "Content-Type": "image",
            },
            body: imageBuffer,
        });

        const { status, url } = await response.json();

        if (status === "success") {
            return url;
        }

        throw new Error("Failed to upload image");
    }

    static async uploadCoupon(metadata: CouponMetadata) {
        const response = await fetch(`/api/storage/coupon/public`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(metadata),
        });

        const { status, url } = await response.json();

        if (status === "success") {
            return url;
        }

        throw new Error("Failed to upload coupon");
    }

    static async uploadStore(metadata: StoreMetadata) {
        const response = await fetch(`/api/storage/store/public`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(metadata),
        });

        const { status, url } = await response.json();

        if (status === "success") {
            return url;
        }

        throw new Error("Failed to upload store");
    }

    static async uploadUser(metadata: UserMetadata) {
        const response = await fetch(`/api/storage/user/public`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(metadata),
        });

        const { status, url } = await response.json();

        if (status === "success") {
            return url;
        }

        throw new Error("Failed to upload user");
    }
}
