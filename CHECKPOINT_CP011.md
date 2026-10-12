# Taskloom CP-011 — Lerd Doctor and Horizontal Status Board

## Included changes

- Repaired `.lerd.yaml`: `proxy` is now a mapping with `command: npm run dev` and `port: 3000` (not a string).
- Redesigned **By status** project layout to horizontal, fixed-width 320–335 px columns, instead of a multi-row grid.
- Added status-board arrows, visible scrollbar, horizontal wheel/trackpad/touch scrolling, keyboard focus, accessible labels, and adaptive controls.
- Improved attachment error reporting: user validation (400), S3 not configured (503), S3 backend error (502), MongoDB unavailable (503), unexpected failures (500).
- S3 errors use readable troubleshooting hints instead of reporting S3 problems as malformed upload requests (400).
- Added attachment error regression tests; no repository database or bucket settings are modified.

## Lerd setup (Fish shell)

```fish
cd ~/Documents/Project-Sites/Experiment/taskloom
cat .lerd.yaml
lerd link
lerd doctor
```

If Lerd does not pick up the YAML changes, unlink/relink using the Lerd UI or the `lerd unlink` and `lerd link` commands. Re-link only when Lerd reports that the host proxy settings are stale. Lerd may request permission to run the host dev command.

## Install and test

```fish
npm install
npm run typecheck
npm run lint
npm test
npm run build
npm audit
```

`npm audit` requires a dependency tree and npm registry access. Do not run `npm audit fix --force` without reviewing which dependencies would be upgraded and whether it introduces breaking changes. The 3 vulnerabilities reported in the screenshot could not be identified from a package-level advisory or lockfile in the supplied source, so those warnings are **not marked fixed**.

### Runtime acceptance

1. Run Lerd Doctor: Project Config should pass without YAML unmarshalling errors.
2. Open `https://taskloom.test`, select a project, then **By status**. Confirm distinct Pending/In progress/Blocked/Completed/Failed columns, visible horizontal scrollbar, arrow navigation, touchpad/keyboard scrolling, filtering, and task editing.
3. Switch to **By list**; confirm the original list board still works and task action menus remain clickable.
4. Upload a supported non-empty file up to 10 MB with a custom label. Confirm a successful 201, attachment shows in table, download and remove work.
5. If upload fails, check the error returned in the browser Network tab: `INVALID_ATTACHMENT`, `S3_NOT_CONFIGURED`, `S3_ACCESS_DENIED`, `S3_REGION_MISMATCH`, `S3_BUCKET_NOT_FOUND`, or `S3_UPLOAD_FAILED`. Check the local server logs for its safe error class.
6. The screenshot's 400 does not include a response body; therefore its original cause cannot be determined. It could have been a file validation error or a backend S3 failure incorrectly returned as 400.
7. Recheck performance **after** the Next.js dev server has completed its initial Turbopack compilation. The reported `GET /` 1276 ms and `POST /api/tasks/:id/attachments` 1116 ms include development and cold compile overhead (the latter log showed ~739 ms in Next.js and 71 ms in application code for the failed request). Profile repeated warm calls separately from S3 upload latency.

## Test scope

Configuration YAML and TypeScript syntax can be verified without dependencies. Full Next.js build, browser runtime interactions, live S3, MongoDB and Lerd Doctor must be verified locally. No commit ID has been created.
