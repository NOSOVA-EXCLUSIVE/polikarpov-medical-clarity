Restore the approved documents snapshot exactly from:
`project-docs/approved-snapshots/documents-approved-2026-04-17-final`

Do NOT redesign.
Do NOT reinterpret.
Do NOT improve copy.
Do NOT change routes.
Do NOT touch questionnaire, booking, admin, portal, payment, or unrelated public pages.

Restore exactly these files:
- `src/app/(public)/documents/page.tsx`
- `src/app/(public)/documents/[slug]/page.tsx`
- `src/features/documents/content.ts`
- `src/components/public/document-detail-page.tsx`
- `src/components/public/shell.tsx`
- `src/app/globals.css`
- `src/app/inline-global-styles.ts`

Source of truth = saved snapshot only.

Return only:
1. which files were restored
2. whether `/documents` and document detail pages now match the saved snapshot
3. stop

Восстанови `documents-approved-2026-04-17-final` без редизайна, только из snapshot.
