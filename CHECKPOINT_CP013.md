# Taskloom CP-013 — Lerd-injected RustFS container endpoint fix

## Evidence

- Lerd environment exposes `AWS_ENDPOINT=http://lerd-rustfs:9000` (container network) and `AWS_URL=http://localhost:9000` (host-accessible candidate), `AWS_BUCKET=lerd`, `AWS_DEFAULT_REGION=us-east-1`.
- Taskloom is host-run by Lerd (`npm run dev` through `lerd-app-taskloom.service`). The container DNS name may be unresolvable from host-run Node.
- Previously HTTP 502 and `Attachment S3 upload failed: Error` hid nested network causes.

## Changes

- `TASKLOOM_S3_ENDPOINT` optionally overrides Lerd's injected `AWS_ENDPOINT` in the server and S3 diagnostic script.
- `TASKLOOM_S3_BUCKET` optionally overrides `AWS_BUCKET`, without assuming the taskloom bucket exists.
- More specific, sanitized diagnostics for underlying network failures.
- Tests for precedence and nested ENOTFOUND/ECONNREFUSED/EAI_AGAIN.
- Updated local setup documentation and `.env.example`.

## Host-run setup

Add to `.env.local`:

```dotenv
TASKLOOM_S3_ENDPOINT=http://127.0.0.1:9000
TASKLOOM_S3_BUCKET=lerd
AWS_ACCESS_KEY_ID=lerd
AWS_SECRET_ACCESS_KEY=lerdpassword
AWS_DEFAULT_REGION=us-east-1
AWS_USE_PATH_STYLE_ENDPOINT=true
```

Leave `AWS_BUCKET=lerd` unless `taskloom` has been created. Run `npm run s3:check` and restart the user service.

## Verification

Static TypeScript syntax checks and 22 Node-based unit tests passed in the patch environment. Live RustFS access, package install, Next.js build and browser upload remain unverified until run on user's host.

## Suggested commit

`fix(taskloom): use host-accessible RustFS endpoint under Lerd`
