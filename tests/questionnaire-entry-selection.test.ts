import assert from "node:assert/strict";
import test from "node:test";
import { allServicesV21, legacyServiceIds, legacyServiceSlugIds } from "@/features/products/services-v21";
import { resolveQuestionnaireEntry } from "@/features/questionnaire/entry-selection";

test("an unselected entry remains neutral without a paid service or price", () => {
  assert.deepEqual(resolveQuestionnaireEntry(null, null), { kind: "choose" });
});

for (const service of allServicesV21) {
  test(`explicit entry preserves ${service.id}, kind and exact catalogue price`, () => {
    assert.deepEqual(resolveQuestionnaireEntry(service.id, null), { kind: "service", service });
  });
}

for (const [legacy, id] of Object.entries({ ...legacyServiceIds, ...legacyServiceSlugIds })) {
  test(`supported legacy link ${legacy} retains its service`, () => {
    const result = resolveQuestionnaireEntry(null, legacy);
    assert.equal(result.kind, "service");
    if (result.kind === "service") assert.equal(result.service.id, id);
  });
}

for (const invalid of ["", "unknown", "live", "__proto__", "constructor"]) {
  test(`invalid explicit selection ${JSON.stringify(invalid)} is never replaced by a paid default`, () => {
    assert.deepEqual(resolveQuestionnaireEntry(invalid, "SECOND_OPINION"), { kind: "invalid" });
    assert.deepEqual(resolveQuestionnaireEntry(null, invalid), { kind: "invalid" });
  });
}

test("explicit second opinion keeps its price even beside an old route parameter", () => {
  const result = resolveQuestionnaireEntry("second-opinion", "MEDICAL_ROUTE");
  assert.equal(result.kind, "service");
  if (result.kind === "service") {
    assert.equal(result.service.id, "second-opinion");
    assert.equal(result.service.amountCents, 8000);
  }
});
