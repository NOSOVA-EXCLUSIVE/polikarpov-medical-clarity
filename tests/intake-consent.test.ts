import assert from "node:assert/strict";
import { test } from "node:test";

import { LEGAL_DOCUMENT_VERSIONS } from "../src/features/legal/versions";
import { INTAKE_DATA_CONSENT_VERSION } from "../src/features/questionnaire/intake-consent-content";
import {
  INTAKE_CONSENT_TTL_SECONDS,
  IntakeConsentRequiredError,
  assertIntakeUploadOwnership,
  requireIntakeConsent,
  signIntakeConsentPayload,
  verifyIntakeConsentPayload
} from "../src/features/questionnaire/intake-consent";
import {
  canContinueFromStep,
  canNavigateToStep,
  createInitialWizardState,
  wizardSteps
} from "../src/components/questionnaire/wizard-logic";

const now = Date.parse("2026-10-27T12:00:00.000Z");
const secret = "synthetic-consent-test-signing-key";
const receiptId = "0e7c34da-a665-45d5-8a57-cf52ab67fe50";
const payload = {
  receiptId,
  acceptedAt: new Date(now).toISOString(),
  expiresAt: now + INTAKE_CONSENT_TTL_SECONDS * 1000,
  textVersion: INTAKE_DATA_CONSENT_VERSION,
  privacyVersion: LEGAL_DOCUMENT_VERSIONS.privacy,
  consentVersion: LEGAL_DOCUMENT_VERSIONS.consent
};

function filledState() {
  const state = createInitialWizardState("NOT_SURE");
  state.selectedServiceId = "second-opinion";
  state.isAdult = true;
  state.confirmsNonEmergency = true;
  state.patient = { fullName: "Тестовый пациент", age: "35", email: "person@example.invalid", phone: "+70000000000", country: "Тест", city: "Тест", timezone: "Europe/Moscow", preferredContact: "EMAIL" };
  state.situation.chiefComplaint = "Синтетическая жалоба";
  state.legal = { acceptedOffer: true, acceptedPrivacy: true, acceptedConsent: true, confirmedInformationAccuracy: true };
  return state;
}

test("all initial consents start empty, and six steps stay intact", () => {
  const state = createInitialWizardState("NOT_SURE");
  assert.equal(state.acceptedIntakeData, false);
  assert.equal(state.confirmedNonEmergencyAtSubmission, false);
  assert.deepEqual(Object.values(state.legal), [false, false, false, false]);
  assert.equal(wizardSteps.length, 6);
});

test("filled clinical fields cannot bypass the missing early consent through step buttons", () => {
  const state = filledState();
  assert.equal(canContinueFromStep(1, state), false);
  for (const step of [2, 3, 4, 5, 6] as const) assert.equal(canNavigateToStep(step, state), false);
});

test("consent does not bypass age, emergency, service or contact prerequisites", () => {
  const state = filledState();
  state.acceptedIntakeData = true;
  assert.equal(canNavigateToStep(6, state), true);
  for (const field of ["isAdult", "confirmsNonEmergency"] as const) {
    state[field] = false;
    assert.equal(canNavigateToStep(2, state), false);
    state[field] = true;
  }
  state.patient.email = "";
  assert.equal(canNavigateToStep(3, state), false);
  state.selectedServiceId = "";
  assert.equal(canNavigateToStep(2, state), false);
});

test("optional history cannot replace the complaint required by the submission API", () => {
  const state = filledState();
  state.acceptedIntakeData = true;
  state.situation.chiefComplaint = "";
  state.situation.priorOperations = "Синтетическая история операции";
  assert.equal(canContinueFromStep(3, state), false);
  assert.equal(canNavigateToStep(4, state), false);
});

test("final non-emergency confirmation remains independent and empty until explicitly checked", () => {
  const state = filledState();
  state.acceptedIntakeData = true;
  assert.equal(canContinueFromStep(6, state), false);
  state.confirmedNonEmergencyAtSubmission = true;
  assert.equal(canContinueFromStep(6, state), true);
});

test("valid signed receipt retains the server timestamp and exact document versions", () => {
  const cookie = signIntakeConsentPayload(payload, secret);
  assert.deepEqual(verifyIntakeConsentPayload(cookie, secret, now + 1000), payload);
});

test("missing, modified, expired and obsolete receipts fail closed", () => {
  assert.throws(() => verifyIntakeConsentPayload(undefined, secret, now), IntakeConsentRequiredError);
  const cookie = signIntakeConsentPayload(payload, secret);
  assert.throws(() => verifyIntakeConsentPayload(cookie.slice(0, -1) + (cookie.endsWith("A") ? "B" : "A"), secret, now), IntakeConsentRequiredError);
  assert.throws(() => verifyIntakeConsentPayload(cookie, "different-key", now), IntakeConsentRequiredError);
  assert.throws(() => verifyIntakeConsentPayload(cookie, secret, payload.expiresAt), IntakeConsentRequiredError);
  assert.throws(() => verifyIntakeConsentPayload(signIntakeConsentPayload({ ...payload, textVersion: "obsolete" }, secret), secret, now), IntakeConsentRequiredError);
  assert.throws(() => verifyIntakeConsentPayload(signIntakeConsentPayload({ ...payload, acceptedAt: new Date(now + 1).toISOString() }, secret), secret, now), IntakeConsentRequiredError);
});

test("upload ownership is bound to this receipt, not a previous case or another visitor", () => {
  assert.doesNotThrow(() => assertIntakeUploadOwnership(`intake/incoming/${receiptId}/document/synthetic.pdf`, receiptId));
  assert.throws(() => assertIntakeUploadOwnership("intake/incoming/document/old.pdf", receiptId), IntakeConsentRequiredError);
  assert.throws(() => assertIntakeUploadOwnership("intake/incoming/another-id/document/file.pdf", receiptId), IntakeConsentRequiredError);
  assert.throws(() => assertIntakeUploadOwnership(`intake/incoming/${receiptId}/../another/document/file.pdf`, receiptId), IntakeConsentRequiredError);
});

test("absent receipt is rejected before DB access, body parsing or file reads", async () => {
  const request = new Request("https://preview.example.invalid/api/uploads/presign", { method: "POST", body: "private-synthetic-body" });
  await assert.rejects(requireIntakeConsent(request), IntakeConsentRequiredError);
  assert.equal(request.bodyUsed, false);
});
