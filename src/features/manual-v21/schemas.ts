import { z } from "zod";

const id = z.string().trim().min(1).max(160);
const body = z.string().trim().min(1).max(12000);
export const manualCallSchema = z.object({ slotId: id }).strict();
export const manualAgreementSchema = z.object({
  serviceId: id,
  amountCents: z.coerce.number().int().positive().max(10000000),
  scope: z.string().trim().min(5).max(12000),
  turnaround: z.string().trim().min(3).max(1000),
  discountSourceCaseId: id.optional(),
  sameClinicalCase: z.boolean().optional(),
  clarificationDays: z.coerce.number().int().min(1).max(30).optional()
});
export const manualPaymentSchema = z.object({ agreementId: id, receivedAt: z.string().max(64), confirmed: z.literal(true) });
export const manualPatientSchemas = {
  "request-call": manualCallSchema,
  "accept-agreement": z.object({ agreementId: id, accepted: z.literal(true) }),
  "open-contact": z.object({ body }),
  "message": z.object({ body, contactId: id.optional() })
};
export const manualStaffSchemas = {
  "link-organizational-call": z.object({ sourceCaseId: id, sameTask: z.literal(true) }),
  "request-call": manualCallSchema,
  "confirm-call": z.object({ slotId: id.optional() }).strict(),
  "cancel-call": z.object({ reason: z.string().trim().min(3).max(1000), slotId: id.optional() }).strict(),
  "complete-call": z.object({}),
  "create-agreement": manualAgreementSchema,
  "record-payment": manualPaymentSchema,
  "start": z.object({ ready: z.literal(true) }),
  "deliver-result": z.object({ body }),
  "reply": z.object({ body, contactId: id.optional() }),
  "open-contact": z.object({ body }),
  "complete-contact": z.object({ contactId: id }),
  "complete": z.object({}),
  "extend": z.object({ until: z.string().max(64), reason: z.string().trim().min(5).max(2000) }),
  "reissue-access": z.object({})
};
