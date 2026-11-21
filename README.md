# ROAM
## Rental Operations and Asset Management
**Move More. Manage Smarter.**

ROAM is a multi-tenant SaaS platform being built for private vehicle rental businesses of all sizes and vehicle types — motorcycles, scooters, cars, SUVs, MPVs, vans, pickups, buses, trucks, and more.

### Product experience
- Public marketing website with responsive mobile layouts and a light/dark theme.
- Fleet, branch, customer, and booking management foundations.
- Planned customer booking portal and rental operations workflows.
- Subscription-aware workspaces for independent operators and growing fleets.
- Future GPS/IoT tracking as a separate, access-controlled module.

### Technology
- Next.js App Router + TypeScript
- PostgreSQL (Neon) + Prisma
- Vercel hosting
- Asia/Manila timezone; PHP (₱) display defaults

### Development
```bash
npm install
cp .env.example .env
npx prisma generate
npm run dev
```

Configure `ROAMDB_POSTGRES_PRISMA_URL` and `ROAMDB_DATABASE_URL_UNPOOLED` before running database commands.

### Gmail SMTP preparation
The `.env.example` file contains placeholders for Gmail SMTP. Before enabling outbound email:
1. Enable 2-Step Verification on the dedicated Gmail account.
2. Create a Google App Password for ROAM.
3. Add the SMTP values to local environment variables and Vercel Production/Preview environments.
4. Never commit the real App Password or share it in chat.

SMTP delivery code, authentication emails, and transactional notification templates will be implemented and tested before being enabled in production.

### Product and security principles
- Strict tenant data isolation on every tenant-owned record and query.
- Server-side authorization; never trust tenant IDs supplied by the browser.
- Booking overlap protection enforced transactionally at the database/service layer.
- Subscription limits enforced by backend services, not only by the UI.
- GPS telemetry is a separate, access-controlled subsystem.

### Marketplace development
- Pre-launch Host and Renter interest capture with admin lead review.
- Workspace Host profiles and private vehicle listing drafts, using existing fleet records.
- Platform-admin preliminary screening with Host-facing feedback and audit history.
- This workflow does not publish vehicle listings, accept marketplace bookings, collect renter payments, or verify legal identity, vehicle ownership, registration, safety, or insurance.
- Marketplace profile/listing records use an additive Prisma migration. Apply it only through the approved release process after CI and release review.

### Legal pages
The Privacy Policy and Terms of Service routes are pre-launch drafts. They must be reviewed and completed with the operator's legal identity, privacy contact, final data flows, retention schedules, commercial terms, and other required details before public launch.

### Status
Early foundation — not production-ready until production database migration, authentication, tenant authorization, operational workflows, email delivery, and security testing have been completed.
