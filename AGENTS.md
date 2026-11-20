# ROAM project instructions for coding agents

## Product and deployment
- ROAM is a multi-tenant vehicle-rental SaaS for fleet, branch, customer, booking, maintenance, finance, and subscription operations.
- Production: https://roamph.vercel.app
- GitHub: https://github.com/engrken/roam (default branch: main).
- Hosting: Vercel Hobby. Database: Neon PostgreSQL in AWS ap-southeast-1 (Singapore).
- The Vercel project is configured to disable Preview Deployments. Do not create preview deployments or preview branches unless the user explicitly asks.
- For an explicitly requested release, commit to main and deploy/verify production directly. Never imply a change is live until Vercel reports READY and the production domain has been checked.
- Keep production resource use within free-tier limits. Vercel Hobby Cron schedules must remain no more frequent than daily. Combine work where practical; avoid adding paid services, paid integrations, or recurring API costs without explicit approval.
- GitHub repository is public. Preserve the existing GitHub Actions CI checks; public-repository Actions usage does not consume the private-repository included-minute allowance.

## Architecture
- Next.js App Router, TypeScript, React.
- PostgreSQL on Neon with Prisma.
- Main application routes are under src/app; reusable services and policies are under src/lib.
- Database schema and migrations are under prisma/.
- Unit tests are under tests/ and use Node's built-in test runner.
- Production database uses the Neon default branch. Never run destructive SQL, reset a branch, or rewrite production data without explicit user approval.

## Required checks
Run the repository's available checks before a production release:
1. npx prisma validate
2. npm run typecheck
3. npm run lint
4. npm test
5. npm run build

The CI workflow is .github/workflows/ci.yml. It runs Prisma validation/generation, type checking, lint, unit tests, and a production build. Keep CI caches and concurrency cancellation enabled.

## Data, security, and product constraints
- Enforce tenant isolation and authorization on the server for every tenant-owned query and mutation. Never trust a tenant ID or role supplied by the browser.
- Preserve the existing authentication, role, subscription-limit, audit, referral, and payment-review policies.
- Subscription QR payments are manually verified by an administrator. Never mark a payment received or activate a paid subscription before verification.
- Complimentary/FREE plan is retired. Do not reintroduce it. The 14-day Starter trial is separate and remains available.
- Do not add PayMongo or another payment gateway unless explicitly requested.
- Keep money formatting in Philippine pesos and workspace date handling timezone-aware (Asia/Manila default).
- Do not commit secrets, .env files, credentials, production connection strings, uploaded receipts, or customer data.

## Cost-conscious development workflow
- Prefer existing platform capabilities and dependencies over adding third-party services.
- Avoid duplicate builds: Vercel handles the production deployment; GitHub Actions remains the quality gate.
- Avoid creating throwaway Neon branches or deployments unless needed for an approved migration/test; clean up temporary resources after use.
- Use ChatGPT for planning, code review, test design, and focused changes. Give it this file plus only the relevant source files/logs instead of repeatedly uploading the whole repository.
- Ask for explicit approval before changing paid plans, enabling paid services, increasing compute, changing billing settings, or making destructive production changes.
