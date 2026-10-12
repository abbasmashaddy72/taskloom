# Taskloom: Dialog and Subtask UX (CP-017)

## Nested editors

- `TaskloomApp` keeps the active top-level editor in `editor` and the subtask editor in `nestedEditor`.
- Opening a subtask from Task Details mounts `nestedEditor` above the still-mounted task editor. Both receive refreshed snapshot data.
- Closing, saving or deleting a nested editor dismisses only that layer. Parent draft fields and subtask-section expand/collapse state remain in memory.
- Parent modal is `inert` and hidden from accessibility APIs while a nested modal is active.

## Confirmation dialogs

- `ConfirmDialog` accepts a title, description, label and callback. Destructive actions use a red confirmation button. Cancel receives initial focus.
- Background clicks do not close either editor or confirmation dialogs; Escape targets the topmost active dialog.
- A heading with subtasks prompts for either safe reclassification to Uncategorised or deletion of the heading and its subtasks.
- No native `window.confirm()` calls remain in Taskloom's application components.

## Descriptions

`subtaskDetails()` removes visual Markdown-only repeats (e.g. `**T4** Fix...` beneath `T4 Fix...`) and returns `null` when there is no additional information. Different descriptions and full source text behind shortened imported titles are revealed with a separate button. Original stored content is left intact so export/import rollback remain unaffected.

## Known limits

- Changes have been source-checked and tested offline, not browser-tested. Verify using the CP-017 acceptance checklist.
- Heading/subtask deletion is permanent and does not create an import-batch undo record. Back up important data or use import history for import-related reversions.
- Single-node MongoDB deletion is retry-safe by deleting child records first, but is not an atomic multi-document transaction.
