# ROAM
## Rental Operations and Asset Management
**Move More. Manage Smarter.**

ROAM is developing a vehicle rental marketplace and operating platform for renters, independent vehicle Hosts, and private rental businesses. The product is designed for motorcycles, scooters, cars, SUVs, MPVs, vans, pickups, buses, trucks, and more. Marketplace discovery and booking are pre-launch; rental businesses can use ROAM Workspace to organize fleet and rental operations.

### Product experience
- Public marketing website with responsive mobile layouts and a light/dark theme.
- Fleet, branch, customer, and booking management foundations.
- Customer booking portal and rental operations workflows, including returning-customer quick-fill.
- Tenant-owned manual rental payment methods (GCash, Maya, QR Ph, bank transfer and cash), private proof submission, and tenant verification before verified ledger posting.
- Tenant financial analytics for rent due, verified rent paid, outstanding balances and overdue rent; Pro operational reports provide date and branch analysis.
- In-workspace onboarding and help guides, plus app version and copyright footer.
- Subscription-aware workspaces for independent operators and growing fleets.
- Future GPS/IoT tracking as a separate, access-controlled module.

### Technology
- Next.js App Router + TypeScript
- PostgreSQL (Neon) + Prisma
- Vercel hosting
- Asia/Manila timezone; PHP (₱) display defaults

### Tenant onboarding guide
See [`docs/tenant-onboarding.md`](docs/tenant-onboarding.md) for the current tenant setup, payment verification, financial analytics and returning-customer workflow.

### Tenant payment workflow
- Rental payment destinations are configured independently by each tenant. Customers pay the tenant directly; ROAM does not pool rental funds.
- Payment proofs remain pending until a tenant-authorized reviewer verifies receipt. Only approved submissions are posted to the rental payment ledger.
- RoamPH subscription billing is separate from tenant rental payments. Automated payment-gateway processing is not part of the current manual-verification workflow.

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

ROAM includes authentication, invitation, booking, subscription and Host review email templates. Host review updates are recorded in the workspace even when email delivery fails; authorized administrators can retry failed Host update emails. Configure and verify SMTP credentials before relying on outbound email in production.

### Product and security principles
- Strict tenant data isolation on every tenant-owned record and query.
- Server-side authorization; never trust tenant IDs supplied by the browser.
- Booking overlap protection enforced transactionally at the database/service layer.
- Subscription limits enforced by backend services, not only by the UI.
- GPS telemetry is a separate, access-controlled subsystem.

### Marketplace development
- Pre-launch Host and Renter interest capture with admin lead review.
- Workspace Host profiles and private vehicle listing drafts, using existing fleet records.
- Platform-admin preliminary screening with Host-facing feedback, durable in-app notifications, transactional email attempts, retry controls and audit history.
- Host profiles and review messages are disclosed in the Privacy Policy; updated legal text requires current Terms and Privacy acceptance.
- This workflow does not publish vehicle listings, accept marketplace bookings, collect renter payments, or certify identity, vehicle ownership, registration, roadworthiness, insurance or legal authority.
- Marketplace interest, Host onboarding and Host notification records use additive Prisma migrations. Apply them only through the approved release process after CI and release review.

### Legal pages
The Privacy Policy and Terms of Service routes are pre-launch drafts. They must be reviewed and completed with the operator's legal identity, privacy contact, final data flows, retention schedules, commercial terms, and other required details before public launch.

### Status
Early foundation — not production-ready until production database migration, authentication, tenant authorization, operational workflows, email delivery, and security testing have been completed.
