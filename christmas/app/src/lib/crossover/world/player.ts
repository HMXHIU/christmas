import { z } from "zod";
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
} from "./appearance";
import { ArchetypesEnum, GendersEnum, RacesEnum } from "./demographic";

export {
    PlayerAppearanceSchema,
    PlayerDemographicSchema,
    PlayerMetadataSchema,
    type PlayerAppearance,
    type PlayerAttributes,
    type PlayerDemographic,
    type PlayerMetadata,
};

type PlayerMetadata = z.infer<typeof PlayerMetadataSchema>;
type PlayerAppearance = z.infer<typeof PlayerAppearanceSchema>;
type PlayerDemographic = z.infer<typeof PlayerDemographicSchema>;
type PlayerAttributes = z.infer<typeof PlayerAttributesSchema>;

const PlayerAppearanceSchema = z.object({
    hair: z.object({
        type: z.enum(HairStylesEnum),
        color: z.enum(HairColorsEnum),
    }),
    eye: z.object({
        type: z.enum(EyeShapesEnum),
        color: z.enum(EyeColorsEnum),
    }),
    face: z.enum(FaceTypesEnum),
    body: z.enum(BodyTypesEnum),
    skin: z.enum(SkinTypesEnum),
    personality: z.enum(PersonalitiesEnum),
    age: z.enum(AgesEnum),
});

const PlayerDemographicSchema = z.object({
    gender: z.enum(GendersEnum),
    race: z.enum(RacesEnum),
    archetype: z.enum(ArchetypesEnum),
});

const PlayerAttributesSchema = z.object({
    str: z.number(),
    dex: z.number(),
    con: z.number(),
    int: z.number(),
    fth: z.number(),
});

const PlayerMetadataSchema = z.object({
    player: z.string(),
    name: z.string().min(1).max(100),
    description: z.string().max(400).optional(),
    avatar: z.string().url(),
    demographic: PlayerDemographicSchema,
    appearance: PlayerAppearanceSchema,
    npc: z.string().optional(),
});
