import { z } from "zod";

import { formatServicePrice, getServiceV21 } from "@/features/products/services-v21";

/** Server-created selection receipt, independent of the four legacy ProductCode values. */
const serviceSelectionSnapshotSchema = z.object({
  catalogVersion: z.literal("2.1"),
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  amountCents: z.number().int().nonnegative(),
  currency: z.literal("EUR"),
  kind: z.enum(["paid_service", "organizational_selection"]),
  priceFrom: z.boolean(),
  durationLabel: z.string().nullable(),
  priceLabel: z.string().min(1).max(120)
});

export type ServiceSelectionSnapshot = Required<z.infer<typeof serviceSelectionSnapshotSchema>>;

export function buildServiceSelectionSnapshot(id?: string | null): ServiceSelectionSnapshot | null {
  if (!id) return null;
  const service = getServiceV21(id);
  if (!service) throw new Error("Выбранный формат услуги не найден. Выберите услугу заново.");

  return {
    catalogVersion: "2.1",
    id: service.id,
    title: service.title,
    amountCents: service.amountCents,
    currency: service.currency,
    kind: service.kind,
    priceFrom: Boolean(service.priceFrom),
    durationLabel: service.durationLabel ?? null,
    priceLabel: formatServicePrice(service)
  };
}

/** Read the stored historical receipt; never replace it with a later catalog price. */
export function readServiceSelectionSnapshot(metadata: unknown): ServiceSelectionSnapshot | null {
  const result = serviceSelectionSnapshotSchema.safeParse(metadata);
  return result.success ? result.data as ServiceSelectionSnapshot : null;
}

export function describeServiceSelection(selection: ServiceSelectionSnapshot): string {
  return `${selection.title} · ${selection.priceLabel}`;
}

export function resolveRequestedProductCode(input: {
  selectedServiceId?: string | null;
  requestedProductCode?: "SECOND_OPINION" | "MEDICAL_ROUTE" | "RECOVERY_4_WEEKS" | "PERSONAL_SUPPORT" | "NOT_SURE";
}) {
  if (input.selectedServiceId) {
    buildServiceSelectionSnapshot(input.selectedServiceId);
    return null;
  }
  return !input.requestedProductCode || input.requestedProductCode === "NOT_SURE" ? null : input.requestedProductCode;
}
