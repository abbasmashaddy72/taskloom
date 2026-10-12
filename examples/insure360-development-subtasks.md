# Insure360 — Development Tasklist

**Status:** `[ ]` Pending · `[x]` Completed and verified · `[-]` In progress · `[!]` Blocked · `[?]` Failed

## List: Central Administration
- [ ] **T1** Improve tenant widgets and Tenant List/View; keep module stats in Module Management.
- [ ] **T2** Organize Backstage Mail navigation; hide/disable Suppression and Event entries without breaking functionality (`MailResource`, `SuppressionResource`, `EventResource`).
- [ ] **T3** Improve Widget Catalogue with Filament components and a Global option; clarify user/tenant/global scopes.
- [ ] **T4** Fix Platform Settings not saving, inspect logs, remove duplicate Save button, reposition Test Email.
- [ ] **T5** Consolidate email settings with `EmailServiceProviderEnum` and Backstage Mails; safely remove redundant `EmailConnection` and related code/tables only where unnecessary.
- [ ] **T6** Improve Payment Administration UI, statuses, errors, and messages.
- [ ] **T7** Generate Razorpay payment links for subscription payments, add currency dropdown, and auto-fill payable amount.
- [ ] **T8** Fix New Subscription creation and display meaningful validation/errors.
- [ ] **T9** Improve Change Plan: exclude current plan, calculate remaining-day proration, and show amount difference/payable or credit before confirmation.
- [ ] **T10** Fix Checkout Session ↔ Subscription Payment mapping; clarify roles and prevent duplicate billing.
- [ ] **T11** Make `ModuleSeeder`/registration idempotent so newly added modules sync automatically without changing existing entitlements.
- [ ] **T12** Replace Module Resource with a dependency-tree Filament Page if appropriate; show dependencies and authorized activation controls; combine Module Inspector.
- [ ] **T13** Fix Plan Title label, clarify Active/Default entitlements, reorganize Plan View/Edit UI.
- [ ] **T14** Improve Tenant View per screenshot; clarify Module Availability/Tenant Settings and add return navigation.
- [ ] **T15** Show and authorize Impersonate only for users with the required permission.
- [ ] **T16** Improve AI Credits UI and correctly show effective quotas/balances.

## List: Account & Shared UI
- [ ] **T17** Fix Account errors using both supplied log files.
- [ ] **T18** Replace phone-number TextInputs with `ysfkaya/filament-phone-input` where appropriate.
- [ ] **T19** Improve Party Form/View layout, fields, and validation.
- [ ] **T20** Replace internal operation keys with readable Export/action labels across modules.

## List: Communications
- [ ] **T21** Clarify and improve Comms Operations; remove overlap where needed.
- [ ] **T22** Fix SMS Header HTTP 403 and display meaningful authorization feedback.
- [ ] **T23** Restore dropdown-based SMS variable bindings (sources, constants, formats) from older ZIP; use a safe registry instead of direct model paths.
- [ ] **T24** Replace `EntitledResource as Resource` aliases with direct `EntitledResource` imports and inheritance.

## List: Permissions & Security
- [ ] **T25** Repair missing permission discovery/registration and incorrect `entitlement.php` restrictions; provide a controlled temporary entitlement-filter switch without bypassing core security.
- [ ] **T26** Review and improve Security Operations purpose, functionality, and UI.
- [ ] **T27** Review Operations Page, distinguish its responsibility from Security/Comms Operations, and consolidate duplicates.
- [ ] **T28** Fix Permission Inspector scope error: “Email configuration cannot be reused across scopes. Resolve a new record.”

## List: Developer, Compliance & Monitoring
- [ ] **T29** Move Architecture Compliance scans to jobs with status, results, retries, and timeout protection.
- [ ] **T30** Fix Issues View `Array to string conversion` from supplied logs.
- [ ] **T31** Improve Review AI Proposal: select existing Analysis ID, disposition, and reason with clear context.
- [ ] **T32** Clarify Record Remediation workflow and add useful validation/history.
- [ ] **T33** Configure Issues AI Analysis using existing Policy AI Import provider infrastructure and appropriate credit handling.
- [ ] **T34** Clarify Compliance Findings and link scan → finding → issue → remediation → verification.
- [ ] **T35** Integrate Horizon into a permission-protected Filament Page using existing views/features where technically possible.
- [ ] **T36** Integrate Pulse into a permission-protected Filament Page using existing views/features where technically possible.

## List: Final Verification & Delivery
- [ ] **T37** Standardize changed Filament UI, translations, permissions, validation, and component formatting.
- [ ] **T38** Run PHP-CS-Fixer and Pint; verify resulting formatting.
- [ ] **T39** Run PHP Insights; target 80%+ in each category and fix actionable findings.
- [ ] **T40** Run PHPStan/Larastan and fix actionable findings.
- [ ] **T41** Run Psalm and fix errors/actionable findings.
- [ ] **T42** Verify app boot, routes, migrations, relevant tests, tenancy, authorization, billing, email, SMS, and queued scans.
- [ ] **T43** Record Git checkpoints with commit hashes and task/verification status.
- [ ] **T44** Deliver complete source ZIP (exclude dependencies, `.git`, secrets, caches, logs), updated checklist, and final report.

## Verification Notes

Record command results, test coverage, blockers, and outstanding issues here. **Do not mark a task completed until verified.**
