# Taskloom CP-012 — RustFS S3 upload validation

## Observed failure

`POST /api/tasks/:id/attachments` returns 502 and `Attachment S3 upload failed: Error` while the provided environment has `AWS_ENDPOINT=https://rustfs.test/insure360` and `AWS_BUCKET=taskloom`.

## Root cause candidate

RustFS S3 path-style requests require a base S3 API endpoint (without a bucket path). The configured `/insure360` segment conflicts with bucket routing and request signing. The RustFS server region is not established from the provided logs; Lerd RustFS defaults commonly use `us-east-1`.

## Changes

- Added `lib/storage-config.ts` validation that rejects RustFS endpoints containing a bucket prefix before any network request.
- `lib/storage.ts` now reads centralized validated configuration for every object operation.
- Upload route distinguishes configuration errors with HTTP 503 and logs non-secret S3 exception name/code/HTTP status.
- `npm run s3:check` tests HeadBucket, PutObject, GetObject and DeleteObject using `.env.local` or `.env`.
- Added unit tests for RustFS path, URL credentials, and validation errors.

## Recommended host-run Next.js .env

```dotenv
AWS_ACCESS_KEY_ID=lerd
AWS_SECRET_ACCESS_KEY=lerdpassword
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=taskloom
AWS_SESSION_TOKEN=
AWS_ENDPOINT=https://rustfs.test
AWS_USE_PATH_STYLE_ENDPOINT=true
```

Use only if the RustFS instance uses the documented Lerd development credentials and default region. Make sure the `taskloom` bucket exists. If `https://rustfs.test` routes to an admin console rather than the S3 API, switch to the actual API listener (normally port 9000). `https://rustfs.test` is not network-verified here.

## Commands

```fish
cd ~/Documents/Project-Sites/Experiment/taskloom
npm run s3:check
npm test
npm run typecheck
npm run build
```

Restart the Lerd-managed Next.js service after editing `.env` or `.env.local` and reattempt the attachment upload. The full production build, live S3 access, and browser upload are not verified here.
