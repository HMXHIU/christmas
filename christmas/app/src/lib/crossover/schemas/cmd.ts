import { z } from "zod";

export const SaySchema = z.object({
    message: z.string(),
});
