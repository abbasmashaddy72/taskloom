# Taskloom CP-015 — Next.js TypeScript build errors

**Input:** Taskloom CP-014 and the reported Next.js 16.4.0 `next build` TypeScript diagnostics.

## Fixes

- `lib/actions.ts`: use MongoDB's `WithId<Document>` for generated import rows, archived snapshot rows and `_id`-dependent helpers. This preserves the requirement that rollback guards compare records with an `_id`, instead of widening the guards or suppressing TypeScript errors. The saved project snapshot is also typed with `_id`.
- `lib/storage-config.ts`: accept `Readonly<Record<string, string | undefined>>` for injectable environment values. `process.env` continues to be the default, while tests can supply only the relevant `AWS_*` and `TASKLOOM_*` entries without providing `NODE_ENV`.
- No import or rollback behavior, S3 endpoint precedence, or Next.js UI functionality was changed by this patch.

## Verification in this environment

- 27 TypeScript unit tests passed using an ephemeral TypeScript-to-CommonJS Node test loader (no production files or dependencies changed).
- 8 import workflow tests passed using the in-memory MongoDB-compatible test double.
- TypeScript syntax parsed successfully in all `.ts` and `.tsx` source files.
- Full `next build` and `tsc --noEmit` **not run** here: npm package registry returned `EAI_AGAIN`, so project dependencies could not be installed.

## Verify in the existing Taskloom installation

```fish
cd ~/Documents/Project-Sites/Experiment/taskloom
npm run typecheck
npm test
npm run lint
npm run build
```

Do not mark CP-015 as fully verified until `npm run build` passes on the host and a subsequent import/undo interaction has been tested.

Suggested Git commit (not created):

```
fix(taskloom): correct MongoDB import row and S3 environment typing
```
