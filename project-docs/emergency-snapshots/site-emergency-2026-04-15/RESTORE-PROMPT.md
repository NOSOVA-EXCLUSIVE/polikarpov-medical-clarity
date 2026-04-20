Restore the emergency site snapshot exactly from:
project-docs/emergency-snapshots/site-emergency-2026-04-15

Do NOT redesign.
Do NOT reinterpret.
Do NOT improve copy.
Do NOT change routes.
Do NOT selectively modernize files.

Restore the entire site codebase from the saved emergency snapshot, using it as the single source of truth.
At minimum restore:
- src/
- public/
- prisma/
- package.json
- package-lock.json
- next-env.d.ts
- tsconfig.json

Do NOT delete older snapshots.
Do NOT make any additional changes beyond restoration.

Return only:
1. what was restored
2. whether the working tree now matches the emergency snapshot
3. stop

Восстанови site-emergency-2026-04-15 строго из emergency snapshot, без любых улучшений.
