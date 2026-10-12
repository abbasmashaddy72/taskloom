# Taskloom — S3 attachments and project-view improvements

## Architecture

Taskloom stores project, task, subtask, list and attachment **metadata** in **local MongoDB**. File **bytes** are written to a **private S3 bucket** using AWS SDK for JavaScript v3 (server-side only). This is optional; tasks work without S3.

Task attachments are uploaded through same-origin Next.js route handlers (Origin header checked for write requests). Download requests verify task and attachment metadata, then redirect to a **60-second presigned GET URL**. Object keys use `taskloom/tasks/<task-id>/<uuid>-<safe-filename>`. No AWS keys are included in the client or ZIP.

### `.env.local` settings

Copy the provided `.env.example` to `.env.local` and fill in your settings:

```ini
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_DEFAULT_REGION=ap-south-1
AWS_BUCKET=your-private-bucket
# Optional: leave blank for AWS; provide URL for S3-compatible storage
AWS_ENDPOINT=
AWS_USE_PATH_STYLE_ENDPOINT=false
# AWS_SESSION_TOKEN=...  (only for short-lived credentials)
```

Prefer an IAM role or AWS credential-provider chain over static access keys when supported. When using a role, omit the static access-key pair. These Laravel-style `AWS_*` keys are **server-side only**. Aliases `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE` are also accepted for compatibility. Restart Next.js / Lerd after editing `.env.local`.

The bucket must stay private. Minimum IAM permissions on `arn:aws:s3:::YOUR_BUCKET/taskloom/tasks/*`: `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`. Bucket public-read and client-exposed credentials are not required. Optional S3-compatible endpoint supported. For MinIO/R2, set `AWS_ENDPOINT` and potentially `AWS_USE_PATH_STYLE_ENDPOINT=true` depending on the provider.

### Limits and supported files

- File formats: PDF, PNG/JPEG/WEBP, TXT/Markdown/CSV/JSON, DOC/DOCX, XLS/XLSX, ZIP.
- Maximum **10 MB** per file; **20 files** total per task; **5 files** per HTTP batch. Larger batches are split automatically.
- User-defined display names, while original filenames are retained for downloading.
- Upload request rows have stable UUID tokens to avoid duplicates when a request is retried.
- Task/list/project deletes remove corresponding S3 objects before removing MongoDB metadata. A failing S3 deletion blocks deletion so it can be retried instead of silently orphaning files.
- If a task is successfully created but the S3 upload fails, the editor retains the task ID for a safe retry. Partial batch success is idempotent.

## Project view

- **Overall List** replaces the former **All tasks** navigation label for the global inventory.
- Project-level tasks default to **By status** cards: Pending, In Progress, Blocked, Completed, Failed.
- Toggle **By list** to see the original grouped task lists; existing list data remains unchanged.
- Multi-select status pills show/hide multiple statuses. **Reset** restores all. A list dropdown narrows either layout to one list.
- The old floating list-action menu was clipped by the horizontally scrolling board. The new **inline expanded menu** keeps Edit/Export actions clickable.
- Task attachment counts are shown on status cards and list cards.

## Local verification (Fish shell)

```fish
cd ~/Documents/Project-Sites/Local/taskloom
test -f .env.local; or cp .env.example .env.local
npm install
npm run typecheck
npm run lint
npm test
npm run build
# Let Lerd manage the app; do not run a second instance on the same port.
lerd link
lerd open
```

### Manual acceptance checklist

1. Without `AWS_BUCKET`, create/edit tasks; attachment button is disabled with a clear message.
2. Fill S3 vars and restart, open an existing task, click **Add file** multiple times, choose files, enter display names, and save.
3. Reopen task and verify the saved names and filenames. Download each; confirm browser receives it as an attachment. Delete one and verify it's removed from both app and bucket.
4. Create a task with attachments; repeat a failed upload without creating duplicate tasks or duplicate attachments.
5. Filter project by multiple statuses, then by a particular list; switch to **By list** and back; confirm counts and task detail editing.
6. Expand a list's `...` menu on mobile/desktop; edit and export. Test sidebar navigation and the mobile menu close overlay.
7. Delete a task, list, then project; confirm metadata and attached objects are removed.
8. Test on your **local trusted machine only**. Taskloom still has no authentication. **Do not expose this app to the public Internet** with working upload endpoints. Add authentication, authorization, stronger CSRF protection, deployment-specific quotas and rate limiting before any multiuser or public deployment.

## Validation note

The patch has been syntax-parsed using installed TypeScript compiler APIs. The current artifact does **not** claim a successful `npm install`, Next.js build, S3 integration test, MongoDB test or browser acceptance test. These require your local dependencies and S3 bucket.
