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
    avatar: string | null;
    name: string;
    timestamp: string;
    message: string;
    color: string;
}

export interface Entity {
    id: number;
    avatar: string | null;
    name: string;
}

export interface ChatCommandGroup {
    key: string;
    label: string;
}

export interface ChatCommand {
    key: string;
    label: string;
    icon: any;
    shortcut: string | null;
}
