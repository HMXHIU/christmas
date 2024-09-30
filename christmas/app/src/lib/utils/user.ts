import { MemberMetadataSchema } from "$lib/community";
import { PlayerMetadataSchema } from "$lib/crossover/world/player";
import { z } from "zod";

export { UserMetadataSchema, type UserMetadata };

type UserMetadata = z.infer<typeof UserMetadataSchema>;

const UserMetadataSchema = z.object({
    publicKey: z.string(),
    community: MemberMetadataSchema.optional(),
    crossover: PlayerMetadataSchema.optional(),
});
