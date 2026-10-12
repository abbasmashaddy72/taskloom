# Taskloom CP-014 — Imports, undo, task links, and searchable menus

This feature checkpoint builds on CP-013. It does not migrate or delete existing MongoDB records on startup. New collections/indexes are created automatically when `getDb()` initializes.

## 1. Linking tasks without duplicates

Open an existing task. Under **Show this task in other projects**, search for a target project and select **Add link**. The referenced task remains in its original project/list. The destination project gets a **Linked tasks from other projects** section with a live shortcut that opens the original task. Deleting the shortcut does not delete the task.

The same editor also supports **Linked tasks across projects**, a relation between two existing tasks from different projects. Both forms of link are idempotent and searchable. Linking a task to its owner project or itself is rejected.

**Data:** `project_task_links` (task/project shortcut) and `task_links` (task/task relationship). Unique indexes prevent identical duplicates. Project, list, and task deletion remove their applicable live shortcuts and links.

## 2. Markdown import choices

Navigate to **Import Markdown**, paste a checklist or upload a Markdown file, and choose a destination:

| Mode | Behavior |
| --- | --- |
| Create a new project | Creates its own project/lists/tasks/subtasks and records an undo batch |
| Add new lists | Appends imported lists to an existing project; never replaces existing lists |
| Replace one selected list | Keep the selected list's identity; replace its tasks with all imported task sections combined |
| Replace matching list names | Case-insensitive, trimmed match against existing list titles; replace matched lists, add others |

The preview displays imported list/task counts and (for replacement) affected existing list/task/subtask/attachment-reference counts. Replacement always requires a confirmation prompt. The server rejects unknown projects/lists, duplicate matching headers, invalid titles, and unparseable input **before** deleting any old data.

**Important:** Replace one selected list flattens multiple imported lists into the selected list (imported list headings are not retained). Consider using Replace matching lists to retain separation for a large checklist.

## 3. Paste checklist inside a task

Open the task and expand **Import subtask checklist**. Paste rows such as:

```markdown
- [ ] Confirm requirements
- [-] Implement feature | due:2026-10-22
- [x] Test component
- [!] Waiting for approval
- [?] Previous attempt failed
```

Choose Append (default) or **Replace existing subtasks**. Nested checkbox rows are flattened into independent first-level subtasks because the data model currently supports a single subtask level. Titles must not exceed 160 characters; maximum 2,000 checklist items and 1 MB input. A successful import creates an undo batch.

## 4. Import history and undo

The **Import history** sidebar item displays the latest 100 batches. Undo is offered only for status `applied`. It checks for changes to the imported lists, tasks, and subtasks, newer work added to an imported/replaced list or imported project, attached files on imported tasks, new task or project links, deleted external targets, and other conflicts. Undo is denied before any deletion if one of those checks fails.

For replacement operations, the original tasks, subtasks, attachment *metadata*, project shortcuts, and task links are stored in the batch snapshot. S3 object bytes are not copied; the original S3 objects are retained as long as the undo archive exists. After undo, metadata is restored using original MongoDB document IDs.

**Caveats:**

- Imports before CP-014 lack historical batch snapshots and **cannot be automatically undone retroactively**.
- A modified or deleted imported task cannot be safely undone as a batch; use manual reconciliation or a MongoDB backup.
- Standalone MongoDB does not support a multi-document transaction in this configuration. A process crash can interrupt import/undo between writes; such batches appear as `preparing`, `undoing`, or `needs_recovery` and require manual investigation.
- Undo is **not** an unlimited backup or version-control system. Make an independent database and S3 backup before replacing valuable work.
- Archived S3 objects remain stored after replacement while history is retained; **no automatic archive retention/garbage collection** is implemented yet. Back up and establish a retention policy before accumulating large histories.
- The in-memory test double verifies workflow logic but does not simulate production concurrency, network failures or MongoDB transactions.

## 5. Sidebar and searchable dropdowns

- Sidebar workspace navigation and project selection use explicit button types, page-selection state, keyboard focus indicators, and persistent last-selected view/project.
- Mobile navigation uses a backdrop and can be closed with Escape; opening a workspace view closes the mobile menu.
- More than five projects reveals a sidebar search field.
- Project/list/status/priority/import selectors now have case-insensitive search, Arrow Up/Down, Enter and Escape handling, and attempt to open upward when near the bottom of a modal.
- The dashboard's onboarding **Make space for your best work** banner displays only while the database contains zero projects.

## 6. Local test commands (Fish)

```fish
cd ~/Documents/Project-Sites/Experiment/taskloom
npm install
npm run typecheck
npm run lint
npm test
npm run build
```

Extra offline tests:

```fish
npm run test:imports
```

Manual acceptance must include desktop and mobile sidebar clicks, all dropdowns near modal boundaries, direct links and reciprocal task links, replacement/undo with live MongoDB, and S3 attachment round trips. The application has **no authentication**, so keep it private and localhost-only; do not expose mutation endpoints to the public internet.
