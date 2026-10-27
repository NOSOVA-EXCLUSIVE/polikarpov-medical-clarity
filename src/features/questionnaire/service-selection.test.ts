import assert from "node:assert/strict";
import test from "node:test";

import { allServicesV21, organizationalSelection } from "@/features/products/services-v21";
import { questionnaireSubmitSchema } from "@/features/questionnaire/schemas";
import {
  buildServiceSelectionSnapshot,
  describeServiceSelection,
  readServiceSelectionSnapshot,
  resolveRequestedProductCode
} from "@/features/questionnaire/service-selection";

function syntheticPayload() {
  return {
    isAdult: true,
    confirmsNonEmergency: true,
    requestedProductCode: "NOT_SURE",
    patient: {
      fullName: "Synthetic Test",
      email: "selection-test@example.invalid",
      phone: "+00000000000",
      preferredContact: "EMAIL",
      country: "Synthetic",
      city: "Synthetic",
      timezone: "UTC"
    },
    caseDetails: { chiefComplaint: "Synthetic selection validation only" },
    redFlags: {},
    legal: {
      acceptedOffer: true,
      acceptedPrivacy: true,
      acceptedMedicalData: true,
      acceptedConsent: true,
      confirmedInformationAccuracy: true
    }
  };
}

for (const service of allServicesV21) {
  test(`server snapshot preserves exact ${service.id} independently of legacy ProductCode`, () => {
    const snapshot = buildServiceSelectionSnapshot(service.id);
    assert.equal(snapshot?.id, service.id);
    assert.equal(snapshot?.catalogVersion, "2.1");
    assert.equal(snapshot?.title, service.title);
    assert.equal(snapshot?.amountCents, service.amountCents);
    assert.equal(snapshot?.currency, "EUR");
    assert.equal(snapshot?.kind, service.kind);
    assert.equal(resolveRequestedProductCode({ selectedServiceId: service.id, requestedProductCode: "SECOND_OPINION" }), null);
    assert.deepEqual(readServiceSelectionSnapshot(snapshot), snapshot);
  });
}

test("unknown service ids are rejected by schema and server resolver", () => {
  assert.equal(questionnaireSubmitSchema.safeParse({ ...syntheticPayload(), selectedServiceId: "invented-service" }).success, false);
  assert.throws(() => buildServiceSelectionSnapshot("invented-service"), /не найден/);
  assert.throws(() => resolveRequestedProductCode({ selectedServiceId: "invented-service", requestedProductCode: "NOT_SURE" }), /не найден/);
});

test("client-supplied names, currency and amounts never become the catalog receipt", () => {
  const parsed = questionnaireSubmitSchema.parse({
    ...syntheticPayload(),
    selectedServiceId: "complex-review",
    amountCents: 1,
    currency: "USD",
    title: "Untrusted client title",
    serviceSelection: { id: "complex-review", amountCents: 1, currency: "USD" }
  });
  const snapshot = buildServiceSelectionSnapshot(parsed.selectedServiceId);
  assert.equal(snapshot?.amountCents, 16000);
  assert.equal(snapshot?.currency, "EUR");
  assert.equal(snapshot?.title, "Комплексный разбор сложной истории");
  assert.equal("serviceSelection" in parsed, false);
  assert.equal("amountCents" in parsed, false);
});

test("legacy four product submissions remain compatible without fabricated v2.1 mapping", () => {
  for (const code of ["SECOND_OPINION", "MEDICAL_ROUTE", "RECOVERY_4_WEEKS", "PERSONAL_SUPPORT"] as const) {
    const parsed = questionnaireSubmitSchema.parse({ ...syntheticPayload(), requestedProductCode: code });
    assert.equal(resolveRequestedProductCode(parsed), code);
    assert.equal(buildServiceSelectionSnapshot(parsed.selectedServiceId), null);
  }
  assert.equal(resolveRequestedProductCode({ requestedProductCode: "NOT_SURE" }), null);
});

test("free organizational selection and from/28-day prices survive receipts", () => {
  const free = buildServiceSelectionSnapshot(organizationalSelection.id)!;
  assert.equal(free.amountCents, 0);
  assert.equal(free.priceLabel, "Бесплатно");
  assert.equal(free.kind, "organizational_selection");
  assert.match(describeServiceSelection(buildServiceSelectionSnapshot("complex-case")!), /от €250/);
  assert.match(describeServiceSelection(buildServiceSelectionSnapshot("recovery-control")!), /€190 \/ 28 дней/);
});

test("stored historical receipts are displayed as recorded, malformed metadata ignored", () => {
  const historical = { ...buildServiceSelectionSnapshot("second-opinion")!, amountCents: 9000, priceLabel: "€90" };
  assert.equal(readServiceSelectionSnapshot(historical)?.amountCents, 9000);
  assert.match(describeServiceSelection(readServiceSelectionSnapshot(historical)!), /€90/);
  assert.equal(readServiceSelectionSnapshot({ ...historical, currency: "USD" }), null);
  assert.equal(readServiceSelectionSnapshot({ ...historical, amountCents: -1 }), null);
  assert.equal(readServiceSelectionSnapshot({ ...historical, catalogVersion: "3.0" }), null);
  assert.equal(readServiceSelectionSnapshot(null), null);
});
