import assert from "node:assert/strict";
import test from "node:test";
import { manualAgreementSchema, manualPatientSchemas, manualPaymentSchema } from "../src/features/manual-v21/schemas";

test("offeracceptanceandmanualreceiptneedexplicitconfirmation", () => {
  assert.equal(manualPatientSchemas["accept-agreement"].safeParse({ agreementId: "synthetic" }).success, false);
  assert.equal(manualPatientSchemas["accept-agreement"].safeParse({ agreementId: "synthetic", accepted: true }).success, true);
  assert.equal(manualPaymentSchema.safeParse({ agreementId: "synthetic", receivedAt: "2026-10-27T12:00:00Z" }).success, false);
});
test("finalofferusesintegerpositivecentsandboundedscope", () => {
  const valid = { serviceId: "second-opinion", amountCents: 8000, scope: "Synthetic agreed scope", turnaround: "3–5 рабочих дней" };
  assert.equal(manualAgreementSchema.safeParse(valid).success, true);
  assert.equal(manualAgreementSchema.safeParse({ ...valid, amountCents: 80.01 }).success, false);
  assert.equal(manualAgreementSchema.safeParse({ ...valid, amountCents: 0 }).success, false);
  assert.equal(manualAgreementSchema.safeParse({ ...valid, scope: "x" }).success, false);
});
test("doctoragreedclarificationperiodhasnoimplicitdefault", () => {
  const value = manualAgreementSchema.parse({ serviceId: "clinical-review", amountCents: 10000, scope: "Synthetic agreed scope", turnaround: "5–7 рабочих дней" });
  assert.equal(value.clarificationDays, undefined);
  assert.equal(manualAgreementSchema.safeParse({ ...value, clarificationDays: 0 }).success, false);
  assert.equal(manualAgreementSchema.safeParse({ ...value, clarificationDays: 31 }).success, false);
});
