Restore the approved questionnaire checkpoint exactly from:
project-docs/approved-snapshots/questionnaire-approved-2026-04-15-working

Do NOT redesign.
Do NOT reinterpret.
Do NOT improve copy.
Do NOT change routes.
Do NOT touch public pages, booking, admin, portal, or backend logic beyond restoring the saved files.

Restore exactly these files:
- src/app/(public)/questionnaire/page.tsx
- src/components/questionnaire/form.tsx
- src/components/questionnaire/wizard-logic.ts
- src/app/api/questionnaire/route.ts
- src/features/questionnaire/fallback-store.ts
- src/features/questionnaire/lead-flow.ts
- src/features/questionnaire/operational-artifacts.ts
- src/features/questionnaire/schemas.ts
- src/features/questionnaire/service.ts
- src/features/questionnaire/status.ts
- src/features/questionnaire/upload-validation.ts
- src/app/globals.css
- src/app/inline-global-styles.ts

Source of truth = saved checkpoint only.

Return only:
1. which files were restored
2. whether questionnaire now matches the saved checkpoint
3. stop

Восстанови questionnaire-approved-2026-04-15-working без изменений и улучшений, только из checkpoint.
