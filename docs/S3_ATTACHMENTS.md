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

## Lerd RustFS troubleshooting

`AWS_ENDPOINT` must be the **S3 API root**, not a bucket URL. Example: `https://rustfs.test` rather than `https://rustfs.test/insure360`. Set the selected bucket in `AWS_BUCKET=taskloom`; the app supplies object keys. Lerd's default RustFS region is generally `us-east-1`, but inspect the actual RustFS configuration if customized.

Run `npm run s3:check` after updating `.env` or `.env.local` to verify bucket access and full object round-trip. If a probe returns HTML, inspect whether `rustfs.test` is routed to a management console or web interface instead of the S3 API endpoint (normally TCP 9000). Verify TLS trust and service state before relaxing any certificate checks; do not set `NODE_TLS_REJECT_UNAUTHORIZED=0`.

## Lerd host-managed Node: prevent Docker-only S3 endpoints (CP-013)

Lerd can inject `AWS_ENDPOINT=http://lerd-rustfs:9000` and `AWS_URL=http://localhost:9000` into a host-managed Node site. `lerd-rustfs` may be resolvable **only inside Lerd's container network**, so host-run Next.js can fail with HTTP 502 on `PutObject`. As process-injected `AWS_ENDPOINT` can override `.env.local`, use an application-specific setting:

```dotenv
# .env.local — actual host-accessible S3 API URL, without bucket path
TASKLOOM_S3_ENDPOINT=http://127.0.0.1:9000
TASKLOOM_S3_BUCKET=lerd
AWS_ACCESS_KEY_ID=lerd
AWS_SECRET_ACCESS_KEY=lerdpassword
AWS_DEFAULT_REGION=us-east-1
AWS_USE_PATH_STYLE_ENDPOINT=true
# Only if you separately created a taskloom bucket:
# TASKLOOM_S3_BUCKET=taskloom
```

Keep the Lerd-provided AWS credentials, `AWS_BUCKET=lerd`, `AWS_DEFAULT_REGION=us-east-1`, and `AWS_USE_PATH_STYLE_ENDPOINT=true`. Taskloom deliberately uses `TASKLOOM_S3_ENDPOINT` before `AWS_ENDPOINT` and `TASKLOOM_S3_BUCKET` before `AWS_BUCKET`, while preserving the existing names for AWS production. `AWS_URL` is not automatically used as an S3 API endpoint because it may represent a public asset URL rather than the API listener.

Validate connectivity from the **host**, not from a RustFS Docker container:

```fish
curl --max-time 5 -i http://127.0.0.1:9000/
npm run s3:check
systemctl --user restart lerd-app-taskloom.service
```

An XML S3 error (such as AccessDenied) from an unauthenticated curl request still indicates that the API listener responds. Connection refusal means that the port is not published to the host. `npm run s3:check` authenticates and tests HeadBucket, PutObject, GetObject and DeleteObject. If it reports `NoSuchBucket`, create the named bucket or keep `AWS_BUCKET=lerd` if that bucket exists. If it reports `SignatureDoesNotMatch`, verify region and credentials. Do not disable TLS verification or expose RustFS credentials in browser code.

In local development, presigned downloads also use the configured endpoint; clients on **other machines** will not be able to open URLs containing `127.0.0.1`. For remote clients, use a host accessible to both Node and the browser, or add a server-side download proxy with authorization.
