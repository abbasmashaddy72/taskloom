# Taskloom CP-017 — Task / Subtask Dialog and Confirmation Improvements

## Changes

1. Opening a subtask editor now adds a second dialog rather than replacing the task editor. The parent task editor remains mounted, retaining unsaved form changes, expanded headings, and scroll position. Saving or deleting the subtask returns to the original task editor.
2. Backdrop clicks no longer dismiss dialogs. Escape closes only the topmost dialog; explicit Cancel and Close buttons remain available.
3. Browser-native confirmations are replaced by a styled, keyboard-accessible Taskloom confirmation dialog for deleting projects, lists, tasks, subtasks, section headings, files, importing with replacement, and rolling back imports.
4. Heading deletion now offers **Keep subtasks** (moves to Uncategorised), **Delete heading and subtasks**, and Cancel. The server action supports both validated modes; the original keep-only signature remains compatible.
5. Repeated Markdown source text beneath subtask titles is suppressed without migrating or rewriting saved MongoDB data. Longer or truly distinct detail text is available behind a **Show details / Hide details** control.
6. Existing Markdown imports, checklist export, stored notes, attachments, status changes, and import-undo behavior are retained.

## Verification

- TypeScript/TSX syntax parsing: 33 files passed.
- Offline TypeScript unit tests (transpiled for execution without dependency installation): 33 passed.
- MongoDB-compatible workflow tests: 17 passed.
- Native browser confirmation references: 0 in application code.
- ZIP structure/integrity: verified during packaging.
- Full Next.js build, ESLint, browser modal tests and live MongoDB/S3 tests: **pending local environment**. npm offline dependency installation failed because the registry packages are not in the cache.

## Local acceptance checklist

- Open a task, scroll to its subtasks, edit one, save; verify the parent task remains open and at its previous scroll position.
- Edit a subtask and Cancel; verify the parent is still open and unsaved parent fields have not reset.
- Delete a subtask; verify the parent remains open, subtask is removed and count is refreshed.
- Click outside each editor and confirmation; verify it stays open. Press Escape and verify only the topmost layer closes.
- Delete a heading containing subtasks and choose **Keep subtasks**; verify those subtasks move to Uncategorised.
- Delete a different heading and choose **Delete heading and subtasks**; verify only that heading and those subtasks are removed.
- Import the original Insure360 Markdown; verify duplicate Markdown descriptions are hidden and long/full descriptions show only on demand.
- Test delete/undo/import replacement confirmations and attachment removal confirmation.
- Run `npm run typecheck`, `npm test`, `npm run lint`, `npm run build`.

## Handoff

This is a complete CP-017 source snapshot built on CP-016. Does not include `node_modules`, `.git`, `.env`/`.env.local`, build outputs, secrets or cached files. No Git commit was created.
