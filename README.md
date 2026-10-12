# Taskloom

**Private task management, with Tailwind CSS 4.** A full-stack Next.js application using **local MongoDB**, server actions, Markdown import/export, light/dark mode, and optional **S3 task attachments**.

## Features

- Dashboard with project completion, task statuses, total workload, active work, and upcoming deadlines.
- Multiple **projects** → multiple **task lists** → **tasks** → **subtasks**. The global inventory is named **Overall List**.
- CRUD for all four levels, including statuses and due dates on subtasks.
- Five statuses: **Pending, In Progress, Blocked, Completed, Failed**.
- Task priorities, due dates, Markdown notes, list assignment, search and filters.
- **By status** project cards or **By list** board, with multi-status and list filters.
- Named multi-file **S3 attachments** in a repeater-style table; private uploads and temporary download links (optional, via `.env.local`).
- Import Markdown into **new projects**, append lists, replace a selected list, or replace lists with matching names.
- **Import history and safe undo** for tracked project imports and task-level Markdown checklists.
- **Cross-project task shortcuts** (one owner, shared progress) and optional task-to-task relationships.
- **Searchable dropdowns** for projects, lists, statuses, priorities, and import targets.
- Import Markdown **inside an existing task** with collapsible `## List:` headings, previews, Append/Replace Matching/Replace All modes, per-heading progress and guarded undo.
- Create, rename, reorder and remove subtask headings; move subtasks between headings and export the structured checklist.
- The onboarding hero is displayed only when no projects exist.
- Export **entire projects or individual lists** to `.md`; subtask structure and metadata are preserved.
- Responsive interface with a persistent light/dark preference (localStorage).
- Local MongoDB for project/task metadata; optional private S3 integration for files. No separate Express backend.
- Seed data for a working demonstration (optional).

## Technical design

| Layer | Implementation |
| --- | --- |
| Frontend | Next.js 16 App Router + React 19 + TypeScript |
| Design system | Tailwind CSS 4 + custom theme tokens + Lucide |
| Data mutations | **Next.js Server Actions** (same app process, no separate Express/REST API) |
| Data access | Official MongoDB Node.js driver 7 |
| Storage | Lerd-managed MongoDB; optional private S3 for attachments |
| Auth | Not included; intended strictly for private localhost use |

**Important:** A browser cannot connect directly to MongoDB securely. Next.js therefore executes database access server-side, in the *same local application process*. **Node.js is still required as the Next.js runtime**; it is not an external API provider. MongoDB is never accessed directly by React in the browser. Attachment APIs are provided by the local Next.js server; AWS credentials stay on the server; file downloads use short-lived signed URLs.

## Start locally using Lerd (Arch / CachyOS)

Use the included `.lerd.yaml` to run Next.js through Lerd's host-proxy mode, with MongoDB in the Lerd-managed Podman service. This requires **no** direct MongoDB package installation and **no** Docker Compose. Node.js 22 and npm are still required (Lerd can manage Node).

```fish
cd taskloom
lerd service preset mongo
lerd service start mongo
cp .env.example .env.local
npm install
npm run typecheck
npm run lint
npm test
lerd link
lerd secure
lerd open
```

Open **https://taskloom.test**. Lerd runs `npm run dev` for you and chooses/proxies the application port. To add optional sample projects, run `npm run seed`.

See **[LERD_SETUP.md](LERD_SETUP.md)** for the complete Fish-compatible setup, environment variables, and troubleshooting. For S3 setup and acceptance checks see **[docs/S3_ATTACHMENTS.md](docs/S3_ATTACHMENTS.md)**. For grouped subtask Markdown import see **[docs/SUBTASK_SECTIONS_IMPORT.md](docs/SUBTASK_SECTIONS_IMPORT.md)**.

**Security:** Taskloom currently has no authentication; do not expose it publicly or use its attachment endpoints in a multiuser installation without authentication, authorization and rate limiting.

The `.env.local` connection string uses the Lerd MongoDB host port, root development credentials, and `authSource=admin`; it is never intended for production.

## Markdown format

````md
# Project: Insure360
> Task tracking and quality improvement

## List: Foundation
- [ ] T1 Push current code to Git | priority:high | due:2026-10-15
  - [x] Check the remote
  - [ ] Create a commit
- [-] T2 Audit the code | priority:high
- [!] T3 Waiting on access

## List: Releases
- [?] Investigate failing deployment
- [x] Document the release
````

The status mapping is:

| Markdown checkbox | Status |
| --- | --- |
| `- [ ]` | Pending |
| `- [-]` or `- [/]` | In Progress |
| `- [!]` | Blocked |
| `- [x]` | Completed |
| `- [?]` | Failed |

- `# Project: Name` defines the project; `## List: Name` defines each task list.
- Indent **two or more spaces** to create a subtask (one level of nesting).
- Add `| priority:low`, `| priority:medium`, or `| priority:high` to tasks.
- Add `| due:YYYY-MM-DD` to tasks and subtasks.
- `| status:completed` etc. explicitly specifies status if desired.
- Standard bullets such as `- Example task` are also accepted as Pending tasks.
- A headerless checklist imports into a default `General` list.
- Importing into an existing project offers **Append**, **Replace one selected list**, and **Replace matching list names**. The append mode does not overwrite or deduplicate tasks.
- The Replace one list mode merges all imported sections into the selected existing list. Replace matching compares trimmed names case-insensitively and creates new lists for nonmatches.
- Both replacement modes record a rollback snapshot for existing tasks, subtasks, attachments and links. Uploaded S3 objects are retained while the archive exists.
- Import history only covers imports made **after this release**. Earlier imports have no recorded before-state and cannot automatically be rolled back.
- Undo refuses to delete later changes, links, attachments or extra work. It is not a general database backup or guaranteed recovery from unexpected process termination.
- Max import size is 1 MB and 2,000 task/subtask lines. Unrecognized prose is ignored.
- Exporting a task list includes its project header, that list, its tasks, and subtasks.

## Project structure

```text
app/
  layout.tsx          Root layout, theme initializer
  page.tsx            Local MongoDB-backed server page
  globals.css         Tailwind 4 theme and reusable UI classes
components/
  taskloom-app.tsx    Dashboard, sidebar, boards, Markdown UI
  editors.tsx         CRUD, project links, task-level checklist import
  search-select.tsx   Searchable keyboard-operable dropdown
  shared.tsx          Status, progress and dialog primitives
lib/
  mongodb.ts          MongoDB connection pooling and indexes
  data.ts             Server-side data loading/serialization
  actions.ts          Server Actions for all CRUD/import mutations
  markdown.ts         Pure Markdown parser, exporter and checklist importer
  import-guards.ts    Undo conflict checks
  types.ts            Shared TypeScript models
scripts/seed.ts       Optional sample content
tests/markdown.test.ts  Markdown unit tests
```

## Verification commands

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

Manual acceptance checklist:

1. Create, rename, recolor, and delete a project.
2. Create, rename, and delete a list, including its nested tasks.
3. Create, edit, complete, and delete tasks; move a task between lists.
4. Create, edit, complete, and delete subtasks; ensure progress changes.
5. Import multiple lists containing tasks and subtasks via `.md`.
6. Export a project and re-import it into a new project; compare statuses and dates.
7. Verify all dashboard metrics, search, status filters, project filters, and overdue badges.
8. Toggle light/dark mode and reload; check mobile navigation.
9. Restart the Lerd MongoDB service/app and confirm persisted data.
10. Disconnect MongoDB and check the visible error/banner and retry flow.
11. Create task A in project 1. In the task editor, **Show this task in other projects** → project 2; verify it appears there and updates when A changes. Remove the shortcut.
12. Link task A to another task in project 2; verify both ends and unlink it.
13. Import Markdown in append mode; open **Import history** and undo the import. Verify lists and counts return to previous values.
14. Replace a populated list with attachments and linked tasks; verify the old tasks disappear from the UI but the physical files remain in S3. Undo and confirm original task IDs, links, file downloads and subtasks are restored.
15. Verify **Replace matching lists** archives only matched lists; unmatched lists are added. Try matching duplicate headings (rejected).
16. Edit an imported task and confirm Undo refuses to remove changed work. Also test adding a task to an empty replaced list before undo.
17. Paste a checklist into a task; test append, replace, and undo. Ensure checkbox status, due date and the 160-character limit are enforced.
18. Exercise each sidebar item (desktop and mobile), including Import history. Close the mobile menu with Escape and backdrop; verify project selection persists on refresh.
19. Search each selection field and use Arrow Up, Arrow Down, Enter, and Escape. Check popup opening near the bottom of the task editor.
20. Confirm the onboarding banner appears with zero projects, and disappears after creating a project.

## Security and data safety

This is a **single-user localhost application**. There is no login or authorization layer. Keep the Next.js process bound to `127.0.0.1` and MongoDB bound to `127.0.0.1`, and **never deploy publicly without authentication and appropriate access controls**. Deletions cascade to child records. Since the default standalone MongoDB instance does not support multi-document transactions, cascade deletion and import compensating cleanup are not fully atomic in cases of interruption or database failure. Back up the Lerd-managed MongoDB service data for valuable records.

## Scope

The app deliberately does **not** include cloud sync, third-party APIs, push notifications, collaboration accounts, or remote access. Everything is designed to run on your machine.

## Attachments and Markdown export

Markdown exports include task/subtask structure but **do not embed S3 file bytes**; downloaded attachments must be backed up separately from the private bucket. Imported Markdown does not restore attachments.


## CP-014 — Imports, rollback, cross-project links and searchable menus

See [CHECKPOINT_CP014.md](CHECKPOINT_CP014.md) for changed source, known limitations and verification requirements.

## CP-011 fixes: Lerd and horizontally scrollable project view

See [CHECKPOINT_CP011.md](CHECKPOINT_CP011.md) for corrected Lerd proxy configuration, scrollable status-board controls, attachment error codes, and Doctor/audit troubleshooting.

### CP-017 — Task and subtask dialogs

Subtask editing now preserves the open parent task editor, including drafts and scroll position. Background clicks never close dialogs. Destructive operations use Taskloom confirmation dialogs. Deleting a subtask heading offers either moving its subtasks to Uncategorised or deleting them with the heading. Duplicate imported Markdown descriptions are hidden until meaningful details are requested. See `docs/DIALOGS_AND_SUBTASKS_CP017.md`.
