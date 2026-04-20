# Restore Prompt For Approved Public Pages

Используй этот промт без изменений, если нужно восстановить approved-вид public pages после любого сбоя.

---

TASK: Restore the LAST APPROVED public pages exactly from the saved local snapshot.

DO NOT redesign.
DO NOT reinterpret.
DO NOT improve.
DO NOT rewrite copy.
DO NOT change routes.
DO NOT touch business logic.
DO NOT touch questionnaire, booking, admin, portal.

Restore ONLY the approved public contour from this local snapshot:

`project-docs/approved-snapshots/public-approved-2026-04-11/`

FILES TO RESTORE EXACTLY:

- `src/app/(public)/page.tsx`
- `src/app/(public)/doctor/page.tsx`
- `src/app/(public)/services/page.tsx`
- `src/app/(public)/layout.tsx`
- `src/components/public/shell.tsx`
- `src/app/globals.css`
- `src/app/inline-global-styles.ts`

SOURCE OF TRUTH:

- the saved snapshot files above
- no new visual ideas
- no new text ideas
- no new composition
- no experiments

EXPECTED RESULT:

1. Home page restored to the approved composition and CTA structure
2. Doctor page restored to the approved trust/authority layout
3. Services page restored to the approved calm 4-card formats layout
4. Header/footer restored to the approved version
5. Public pages open correctly after restore

IMPORTANT:

If any dependency mismatch appears, fix it only in the safest way required to make the restored approved pages open exactly as saved in the snapshot.

RETURN ONLY:

1. which files were restored
2. whether home / doctor / services now match the saved snapshot
3. stop there

---

Короткая команда для себя:

Восстановить public pages ИСКЛЮЧИТЕЛЬНО из snapshot `public-approved-2026-04-11`, без редизайна и без новых идей.
