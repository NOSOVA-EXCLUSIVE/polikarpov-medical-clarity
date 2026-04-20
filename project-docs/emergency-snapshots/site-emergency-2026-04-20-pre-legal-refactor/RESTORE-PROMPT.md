Restore the emergency site snapshot exactly from:
project-docs/emergency-snapshots/site-emergency-2026-04-20-pre-legal-refactor

This is a strict restoration task.

DO NOT:

* redesign
* reinterpret
* improve copy
* change routes
* selectively modernize files
* refactor
* fix unrelated issues
* add comments
* change formatting unless required by exact restoration
* delete older snapshots
* create a new design pass

Use the emergency snapshot as the single source of truth.

Restore the entire site codebase from that snapshot.

At minimum restore:

* src/
* public/
* prisma/
* server/
* jobs/
* emails/
* types/
* static/
* docs/
* prompts/
* package.json
* package-lock.json
* next-env.d.ts
* tsconfig.json

If additional root/config files are included in the snapshot, restore them too so the working tree matches the emergency snapshot exactly.

After restoration:

1. verify whether the working tree matches the emergency snapshot
2. do not make any further changes
3. stop immediately after reporting status

Return only:

1. what was restored
2. whether the working tree now matches the emergency snapshot
3. stop

Восстанови `site-emergency-2026-04-20-pre-legal-refactor` строго из emergency snapshot, без любых улучшений и без любых дополнительных изменений.
