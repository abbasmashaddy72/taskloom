# Taskloom CP-014 — Linked projects, rollback imports, searchable menus

**Based on:** CP-013 RustFS host endpoint checkpoint. Existing S3 and Lerd settings are preserved.

## Implemented

1. Project shortcuts for an existing task (`project_task_links`), shown in target Project View, without duplicate task ownership.
2. Bidirectional task-to-task references across different projects (`task_links`).
3. Import batches (`import_batches`) with undoable new-project, append-list and replace-list imports.
4. Replace a selected list or replace matching-name lists, with live impact preview and confirmation.
5. Import a Markdown checklist inside an existing task as appended/replaced subtasks.
6. View Import history and undo when current imported records match their original inserted state.
7. Save/restore original task IDs, subtasks, links, attachment metadata on list replacement; preserve original S3 objects for undo.
8. Searchable project/list/status/priority/import selectors and sidebar project search.
9. Sidebar button semantics, active navigation, last-view persistence, Escape for mobile navigation.
10. Show the onboarding hero only if there are no projects.
11. Additional safety: input validation, duplicate-heading detection, rollback conflict checks, no automatic S3 object deletion during replacement.

## Verification achieved in this isolated environment

- 28 TypeScript/TSX files parsed with **0 TypeScript syntax diagnostics** (without resolving unavailable dependencies).
- 35/35 unit and in-memory workflow tests passed: 27 pure unit tests + 8 MongoDB-compatible test-double workflow tests.
- XML/YAML/base S3 settings retained from CP-013.

## Verification NOT completed

- `npm install` could not reach the npm registry in this environment.
- Full `npm run typecheck`, `npm run lint`, `npm run build` and browser interactions cannot be claimed as passing.
- Live MongoDB replacement/recovery and RustFS object restoration require testing on the user's machine.
- The reported **sidebar clicks not working** has been addressed in code but is not confirmed fixed by browser testing.

## Recovery, persistence and limitations

- Imports created **before** CP-014 cannot be automatically undone; only new import batches are tracked.
- Import archives retain old S3 objects indefinitely until a separate retention/cleanup policy is implemented.
- MongoDB standalone has no multi-document transaction; an interrupted batch can require manual recovery.
- Tasks modified after import intentionally block undo, rather than silently deleting newer work.
- The application has no login/authorization; keep it on private local development infrastructure.

See [docs/IMPORTS_LINKS_AND_MENUS.md](docs/IMPORTS_LINKS_AND_MENUS.md) for acceptance tests, examples and workflow details.

Suggested commit (not created):

```
feat(taskloom): add cross-project task links and reversible Markdown imports
```
