import { z } from "zod";

export const threadMessageSchema = z.object({
  body: z.string().trim().min(1).max(4000)
});

export type ThreadMessageInput = z.infer<typeof threadMessageSchema>;
