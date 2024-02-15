import { PlayerMetadataSchema } from "$lib/crossover/types";
import yup from "yup";

export const UserMetadataSchema = yup.object().shape({
    publicKey: yup.string().required(),
    crossover: PlayerMetadataSchema.optional().default(undefined), // yup casts to {} if undefined
});

export type UserMetadata = yup.InferType<typeof UserMetadataSchema>;

export const CouponMetadataSchema = yup.object().shape({
    name: yup.string().required(),
    description: yup.string().required(),
    image: yup.string().required(),
});

export type CouponMetadata = yup.InferType<typeof CouponMetadataSchema>;

export const StoreMetadataSchema = yup.object().shape({
    name: yup.string().required(),
    description: yup.string().required(),
    image: yup.string().required(),
    address: yup.string().required(),
    latitude: yup.number().required(),
    longitude: yup.number().required(),
});

export type StoreMetadata = yup.InferType<typeof StoreMetadataSchema>;
