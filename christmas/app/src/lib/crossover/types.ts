import yup from "yup";

export const PlayerMetadataSchema = yup.object().shape({
    player: yup.string().required(),
    name: yup.string().required(),
    tile: yup.string().optional(),
});

export type PlayerMetadata = yup.InferType<typeof PlayerMetadataSchema>;

export interface MessageFeed {
    id: number;
    host: boolean;
    avatar: number;
    name: string;
    timestamp: string;
    message: string;
    color: string;
}
