import { z } from "zod";
import {
    AGE_TYPES,
    BODY_TYPES,
    EYE_COLORS,
    EYE_TYPES,
    FACE_TYPES,
    HAIR_COLORS,
    HAIR_TYPES,
    PERSONALITY_TYPES,
    SKIN_TYPES,
} from "./appearance";
import { ARCHETYPE_TYPES, GENDER_TYPES, RACE_TYPES } from "./demographic";

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
        type: z.enum(HAIR_TYPES),
        color: z.enum(HAIR_COLORS),
    }),
    eye: z.object({
        type: z.enum(EYE_TYPES),
        color: z.enum(EYE_COLORS),
    }),
    face: z.enum(FACE_TYPES),
    body: z.enum(BODY_TYPES),
    skin: z.enum(SKIN_TYPES),
    personality: z.enum(PERSONALITY_TYPES),
    age: z.enum(AGE_TYPES),
});

const PlayerDemographicSchema = z.object({
    gender: z.enum(GENDER_TYPES),
    race: z.enum(RACE_TYPES),
    archetype: z.enum(ARCHETYPE_TYPES),
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
});
