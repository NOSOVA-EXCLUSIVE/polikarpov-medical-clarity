import { z } from "zod";

export const holdSlotSchema = z.object({
  slotId: z.string().trim().min(1)
});

export const createCheckoutSchema = z.object({
  slotId: z.string().trim().min(1)
});

export const createCalendarSlotSchema = z.object({
  startsAtIso: z.string().datetime(),
  durationMinutes: z.coerce.number().int().positive().max(24 * 60),
  timezone: z.string().trim().min(2).max(120)
});

export const updateCalendarSlotSchema = z.object({
  action: z.enum(["block", "release"]),
  note: z.string().trim().max(2000).optional().default("")
});

export type HoldSlotInput = z.infer<typeof holdSlotSchema>;
export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;
export type CreateCalendarSlotInput = z.infer<typeof createCalendarSlotSchema>;
export type UpdateCalendarSlotInput = z.infer<typeof updateCalendarSlotSchema>;
