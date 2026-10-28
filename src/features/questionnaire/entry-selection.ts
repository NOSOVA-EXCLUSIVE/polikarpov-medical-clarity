import { getServiceV21, legacyServiceIds, legacyServiceSlugIds, type ServiceV21 } from "@/features/products/services-v21";

export type QuestionnaireEntrySelection =
  | { kind: "choose" }
  | { kind: "invalid" }
  | { kind: "service"; service: ServiceV21 };

/** An explicit service wins; an absent or unknown selection never purchases the first tariff. */
export function resolveQuestionnaireEntry(raw: string | null, legacy: string | null): QuestionnaireEntrySelection {
  if (raw === null && legacy === null) return { kind: "choose" };
  let id = raw;
  if (raw === null && legacy !== null) {
    const codes: Record<string, string> = legacyServiceIds;
    id = Object.prototype.hasOwnProperty.call(codes, legacy) ? codes[legacy] :
      Object.prototype.hasOwnProperty.call(legacyServiceSlugIds, legacy) ? legacyServiceSlugIds[legacy] : null;
  }
  if (!id) return { kind: "invalid" };
  const service = getServiceV21(id);
  return service ? { kind: "service", service } : { kind: "invalid" };
}
