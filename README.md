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
- Import Markdown into **a new project** or append its lists to an existing project.
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

See **[LERD_SETUP.md](LERD_SETUP.md)** for the complete Fish-compatible setup, environment variables, and troubleshooting. For S3 setup and acceptance checks see **[docs/S3_ATTACHMENTS.md](docs/S3_ATTACHMENTS.md)**.

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
- Importing into an existing project appends new lists and tasks; it does **not** overwrite existing tasks or deduplicate them.
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
  editors.tsx         CRUD modals
  shared.tsx          Status, progress and dialog primitives
lib/
  mongodb.ts          MongoDB connection pooling and indexes
  data.ts             Server-side data loading/serialization
  actions.ts          Server Actions for all CRUD/import mutations
  markdown.ts         Pure Markdown parser and exporter
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

## Security and data safety

This is a **single-user localhost application**. There is no login or authorization layer. Keep the Next.js process bound to `127.0.0.1` and MongoDB bound to `127.0.0.1`, and **never deploy publicly without authentication and appropriate access controls**. Deletions cascade to child records. Since the default standalone MongoDB instance does not support multi-document transactions, cascade deletion and import compensating cleanup are not fully atomic in cases of interruption or database failure. Back up the Lerd-managed MongoDB service data for valuable records.

## Scope

The app deliberately does **not** include cloud sync, third-party APIs, push notifications, collaboration accounts, or remote access. Everything is designed to run on your machine.

## Attachments and Markdown export

Markdown exports include task/subtask structure but **do not embed S3 file bytes**; downloaded attachments must be backed up separately from the private bucket. Imported Markdown does not restore attachments.


## CP-011 fixes: Lerd and horizontally scrollable project view

See [CHECKPOINT_CP011.md](CHECKPOINT_CP011.md) for corrected Lerd proxy configuration, scrollable status-board controls, attachment error codes, and Doctor/audit troubleshooting.
