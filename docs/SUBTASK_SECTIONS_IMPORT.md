# Taskloom CP-016 — Markdown headings inside subtasks

The original Insure360 checklist is accepted **without editing the Markdown**. Paste `examples/insure360-development-subtasks.md` into an existing task's **Import Markdown into subtasks** panel.

## Use

1. Open an existing project and open the parent task, such as `T4 Check every application page for errors`.
2. Expand **Import Markdown into subtasks**.
3. Paste the contents of `examples/insure360-development-subtasks.md` unchanged.
4. Confirm the preview says **44 subtasks / 6 headings**. The `## Verification Notes` text is recognized as notes, not a seventh task section.
5. Choose a mode and press **Import**. Confirm replacement when prompted.
6. Use each heading's disclosure arrow to collapse/expand its subtasks. Each group has independent completed/total counts.
7. Use **Export** in the Subtasks card to download the heading-aware checklist as Markdown.

## Import modes

| Mode                      | What changes                                                                                                  | Undo behavior                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Append                    | Adds items and creates missing headings; reuses existing headings with the same case-insensitive title        | Removes the newly imported items and headings only if they remain unchanged                             |
| Replace matching headings | Replaces subtasks in headings with matching names, preserves all unmatched sections and adds missing headings | Restores archived subtasks and removes generated items/headings only if no incompatible edits were made |
| Replace all               | Replaces all headings and subtasks under the parent task                                                      | Restores archived subtasks, headings, document title, introduction and verification notes               |

After import, open **Import history** to undo a recorded import. Undo refuses to remove imported sections or subtasks when their contents have changed, or when new subtasks have been added to headings owned by the import. The operation also protects imported project/list contents and their archival references. **Undo of a batch created prior to CP-016 follows the legacy rules**, and old flat subtasks remain visible as _Uncategorised_.

## Markdown syntax

```md
# Insure360 — Development Tasklist

**Status:** `[ ]` Pending · `[x]` Verified

## List: Central Administration

- [ ] **T1** Improve tenant widgets.
- [-] **T2** Review administration.

## List: Communications

- [!] **T3** Fix SMS provider failure.

## Verification Notes

Record verification results here. Do not mark tasks completed before verification.
```

- One-level headings use `## Heading` or `## List: Heading`.
- Checkboxes map `[ ]` Pending, `[x]` Completed, `[-]` In Progress, `[!]` Blocked, `[?]` Failed. Due-date metadata (` | due:YYYY-MM-DD`) continues to work.
- The document's `# Title`, status legend or other pre-section text, and `## Verification Notes` text are stored separately and shown in the task's Subtasks area.
- Inline backticks and `**T1**` formatting are normalized for display; the original Markdown row is saved as subtask details where formatting or length requires it.
- Subtask titles remain ≤160 characters. For longer imported lines, the display title is shortened at a word boundary with an ellipsis, and the full original text is stored in the subtask's _Details_ field (up to 5,000 characters).
- Subtasks outside a named heading appear in **Uncategorised**.
- Empty headings alongside an otherwise valid checklist are allowed. Duplicate section titles, ignoring case, are rejected before any database changes.

## Heading management

- Add a heading, rename it, move it up/down, or remove it.
- **Removing a heading does not delete its subtasks:** they move to Uncategorised.
- Move individual subtasks between headings with the searchable **Heading** control in the subtask editor.
- Adding a subtask from inside a heading automatically selects that heading.

## Data model and compatibility

- New `subtask_sections` MongoDB collection stores first-level headings.
- Existing `subtasks` now optionally contain `sectionId` and `description`; older documents remain valid and display under Uncategorised.
- Existing task documents may contain `checklistTitle`, `checklistIntro`, `checklistNotes`.
- Import batches record new sections, deleted-section snapshots, checklist metadata before/after, and original subtask snapshots for guarded undo.
- Project/list replacement now archives and restores the section documents of the tasks it replaces.
- No schema migrations are necessary for MongoDB's flexible document structure.

## Verification and limitations

Run on the Lerd host in Fish:

```fish
cd ~/Documents/Project-Sites/Experiment/taskloom
npm install
npm run typecheck
npm test
npm run lint
npm run build
systemctl --user restart lerd-app-taskloom.service
```

Then import the included Markdown into a noncritical test task. Inspect all six headings and check Export, Append, Replace matching, Replace all, editing, and Import History undo. Back up MongoDB before replacing existing task data. The in-memory MongoDB-compatible tests validate code paths but do not replace a live database/browser test.

Security and concurrency: Taskloom remains a private local-only application without authentication. Its existing import mechanism uses guarded snapshots with compensating recovery, not MongoDB multi-document transactions. For multiuser deployments or concurrent administrators, add identity, authorization, and transactional locking before allowing destructive imports.
