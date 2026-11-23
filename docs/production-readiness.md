# ROAM production readiness and staged rollout

Last reviewed: 2026-11-24

This document records the current pilot baseline and the release gates for expanding beyond the two existing test tenants. It is an operational checklist, not a legal or security certification.

## Current pilot baseline

- Production application: https://roamph.vercel.app
- Source repository: https://github.com/engrken/roam (public repository, default branch `main`)
- Hosting: Vercel Hobby. The Hobby plan is for non-commercial personal use. Move to an appropriate commercial plan before ROAM is used to generate revenue or operated as a commercial SaaS. See https://vercel.com/docs/plans/hobby and https://vercel.com/docs/limits/fair-use-guidelines.
- Database: Neon Free organization, project `roamph`, AWS ap-southeast-1 (Singapore).
- Neon Free currently includes 100 CU-hours per project per month, 1 GB of Postgres storage, and a six-hour instant-restore window. Production compute is currently fixed at 0.25 CU. Monitor compute usage, storage, and network transfer in the Neon console; do not assume Free-tier capacity is suitable for public growth.
- Production database currently contains two pilot tenants. Keep both tenants and their records intact during rollout.
- A one-time production snapshot named `pre-production-hardening-2026-11-24` was created before this hardening batch. It expires on 2026-12-24. Automatic snapshot scheduling is not enabled for this project, so this is a temporary safety point—not a substitute for a durable backup and restore plan.
- Vercel Hobby cron jobs are configured daily in `vercel.json`. Keep these schedules daily or less frequent unless the hosting plan changes.
- GitHub Actions runs Prisma validation/generation, type checking, lint, unit tests, and a production build. The repository is public. No repository rulesets were returned by the GitHub API; branch protection could not be verified through the current integration, so verify it in GitHub Settings before broad rollout.
- Production SMTP, OTP, cron, Blob, and VAPID environment-variable entries exist. Keep secret values in Vercel; never copy them into source control or logs.
- The production database had no registered browser push subscriptions at the time of this review. Push delivery still needs a real-device end-to-end test.
- The Privacy Policy, Terms of Service, Host Agreement, and renter terms contain draft material. Obtain appropriate legal review and complete the operator identity, privacy contact, data retention, consent, and commercial terms before public launch.

## Rollout stages

### Stage 1 — Two-tenant pilot (current)

Keep the two existing tenants on the production domain while validating real workflows. Do not use production as a load-test environment and do not create synthetic customer or payment records in either tenant.

Required checks:

- Sign-in code request, delivery, verification, expiration, retry, and logout.
- Tenant A cannot read or mutate Tenant B's customers, bookings, vehicles, payment records, receipts, or documents, and vice versa.
- Two simultaneous booking attempts for the same vehicle and overlapping period cannot both succeed.
- Booking status transitions are valid and cannot be skipped by direct API calls.
- Customer rental-payment proof remains pending until an authorized tenant reviewer approves it.
- Rejected payment submissions do not create verified ledger entries.
- Deposit collection, deductions, refunds, and remaining balances reconcile with the booking ledger.
- File uploads enforce size/type limits and private document access is checked server-side.
- Handover and return inspections preserve odometer, fuel, condition, and photo evidence.
- Email reminders are sent once for pickup/return dates; overdue reminders are once per tenant-local day.
- Browser push is tested on at least one Android/Chrome device and one supported iOS Home Screen web app, including opt-out and expired subscription cleanup.
- The tenant owner confirms the workflow against their actual operating process.

### Stage 2 — Invite-only expansion

Before adding tenants beyond the two pilots:

- Complete the Stage 1 checks and resolve all high-severity findings.
- Upgrade Vercel to a commercial plan before commercial use.
- Verify the production database connection uses Neon's pooled endpoint for serverless application traffic and the direct endpoint for Prisma migrations.
- Confirm production environment variables are complete without exposing their values.
- Configure GitHub branch protection/rules so changes to `main` require a pull request and successful CI.
- Confirm SMTP sender authentication and deliverability with real inboxes.
- Establish a support contact, incident owner, and a documented manual booking/payment recovery process.
- Review Neon Free-plan quotas and decide whether the database should remain on Free or move to a paid plan based on observed usage and required recovery window.
- Rehearse restoring a snapshot into a separate branch; never test restore by replacing the production branch.

### Stage 3 — Public/commercial launch

Do not open public registration or market ROAM as a commercial SaaS until all of the following are true:

- Vercel plan permits the intended commercial use.
- Legal pages and consent flows are reviewed and finalized.
- Tenant isolation, booking concurrency, payment approval, and private file access have automated regression coverage.
- Database backups and restore procedures meet the business recovery requirements.
- Monitoring and incident response are operational.
- Subscription billing, refunds, support, and account offboarding are documented and tested.
- Actual push and email delivery have been verified with production devices and inboxes.

## Deployment and migration rules

1. Work on a feature branch and open a pull request.
2. Run the repository CI checks: Prisma validate/generate, typecheck, lint, tests, and production build.
3. Test schema migrations on an isolated Neon branch created from production data.
4. Take a fresh production snapshot immediately before any production schema migration.
5. Apply only additive, backward-compatible migrations first. Do not reset production, delete tenant records, or rewrite financial history.
6. Deploy code only after migration compatibility is confirmed.
7. Verify the production deployment is Ready, then smoke-test sign-in, workspace access, booking, payment review, health, email, and push endpoints.
8. Keep the two pilot tenants on the release and monitor for at least one complete booking/payment cycle before inviting more tenants.

## Known engineering follow-ups

- Add database-level tenant-consistency constraints to child records after auditing every write path and existing row. Do not deploy these constraints until the migration has been tested against a production-derived Neon branch.
- Add a database-backed reservation exclusion strategy for vehicle/time overlaps; the existing application transaction checks should remain in place.
- Add integration and browser end-to-end tests for tenant isolation, simultaneous bookings, payment approval/rejection, and document authorization.
- Review pagination and batch processing for scheduled reminders and subscription lifecycle jobs before tenant volume grows.
- Establish a reproducible dependency lockfile before changing CI to `npm ci`. The repository currently does not contain a committed `package-lock.json`; do not switch to `npm ci` until one is generated, reviewed, and committed.
- Revisit database connection pooling. The Neon production compute currently reports pooling disabled; verify the Vercel Prisma application URL is actually using the pooled host before enabling broader traffic.
