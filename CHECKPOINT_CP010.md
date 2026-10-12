# Taskloom CP-010 — S3 Attachments and Project Status View

**Date:** 2026-10-12

## Deliverables

- Laravel-style `.env.local` S3 configuration (`AWS_BUCKET`, `AWS_DEFAULT_REGION`, `AWS_ENDPOINT`, `AWS_USE_PATH_STYLE_ENDPOINT`, credentials), plus `S3_*` alias support.
- Server-side, private S3 uploads via Next.js App Router, custom display names and multiple attachment rows, UUID retry tokens, 10 MB per file, 20 per task, 5 per batch.
- S3 short-lived signed download, attachment deletion, cleanup on task/list/project deletion.
- Overall List navigation label, project By status/By list views, multi-status selection and list dropdown filter.
- Non-clipped inline list action menus with Edit/Export, status card attachment counts.
- Dependency-free file-policy unit tests and documentation.
- Lerd npm scripts respect injected HOST and PORT.

## Validation evidence

- TypeScript/TSX syntax parsing via installed TypeScript compiler: 23 source/test files, **0 parse errors**.
- Pure attachment-policy smoke tests: **7 assertions passed**.
- `package.json` parses successfully.
- AWS SDK client-credentials and S3 endpoint not available here, so **no S3 upload/download was exercised**.
- Dependency installation exceeded the execution timeout; **no npm typecheck, lint, test suite or Next.js build was completed**.
- Browser/Lerd proxy and MongoDB acceptance tests are **pending on the user's local installation**.
- No `.git` repository present in packaged project; **no Git commit ID available**.

## Suggested commit

`feat(taskloom): add S3 attachments, status board and working list menus`

## Safety and known constraints

- Taskloom is **local-only and unauthenticated**; do not expose S3 endpoints to the public Internet. Same-origin checks are not a replacement for authentication and authorization.
- Partial S3 upload rollback is best effort if S3 is unavailable during cleanup; storage reconciliation is recommended for production use.
- Markdown exports do not embed external S3 objects.
- No secrets, `.env.local`, dependencies, caches, logs or `.git` were included.

See [docs/S3_ATTACHMENTS.md](docs/S3_ATTACHMENTS.md) for local setup and manual acceptance tests.
