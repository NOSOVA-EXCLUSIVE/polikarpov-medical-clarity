# Restore Prompt

Restore the approved public snapshot exactly from:

`project-docs/approved-snapshots/public-approved-2026-04-12-home-final`

Do NOT redesign.
Do NOT reinterpret.
Do NOT improve copy.
Do NOT change routes.
Do NOT touch questionnaire, booking, admin, or portal.

Restore exactly these files:

- `src/app/(public)/page.tsx`
- `src/app/(public)/doctor/page.tsx`
- `src/app/(public)/services/page.tsx`
- `src/app/(public)/layout.tsx`
- `src/components/public/shell.tsx`
- `src/app/globals.css`
- `src/app/inline-global-styles.ts`

Source of truth = saved snapshot only.

Return only:

1. which files were restored
2. whether home / doctor / services now match the saved snapshot
3. stop

Short emergency command:

`Восстанови public-approved-2026-04-12-home-final без редизайна, только из snapshot.`
