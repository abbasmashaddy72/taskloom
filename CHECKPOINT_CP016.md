# Taskloom — CP-016: Structured Subtask Sections

## Objective
Accept the user's original Insure360 44-task Markdown **as-is** when importing subtasks into a parent task. Preserve all six task headings, checkbox statuses, verification instructions and original long lines.

## Changes
- Added section-aware checklist parsing and Markdown export to `lib/markdown.ts`.
- Created the `subtask_sections` MongoDB collection model, task checklist metadata, and optional subtask details.
- Added section CRUD, safe heading removal, section ordering, and validated subtask reassignment actions.
- Added Append, Replace matching headings and Replace all import modes with rollback snapshots and fail-closed undo checks.
- Extended project/list replacement archives to preserve headings of archived tasks.
- Added collapsible section cards, progress indicators, task/section action buttons, import preview and Markdown export to the task editor.
- Included `examples/insure360-development-subtasks.md`, kept in the original markdown form.

## Verification
- 15/15 offline import-workflow tests passed via an in-memory MongoDB-compatible test double.
- 31/31 Markdown / guard / attachment / storage / section parser tests passed with global ts-node transpile-only.
- TypeScript/TSX parser validation passed for updated sources.
- Full `npm install`, typecheck, lint, production build and live Lerd/MongoDB/browser tests are **NOT VERIFIED** because installing npm dependencies timed out in the execution environment.
- No Git commit has been created. Keep feature status *In Progress* until local acceptance.

## Suggested commit
`feat(taskloom): add sectioned subtask Markdown import and guarded rollback`
