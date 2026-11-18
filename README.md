# ROAM
## Rental Operations and Asset Management
**Move More. Manage Smarter.**

ROAM is a multi-tenant vehicle-rental SaaS platform for independent rental operators, with a customer booking portal, fleet operations, subscription plans, and a future GPS/IoT tracking module.

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

Configure `DATABASE_URL` before running database migrations.

### Product principles
- Strict tenant data isolation on every tenant-owned record and query.
- Server-side authorization; never trust tenant IDs supplied by the browser.
- Booking overlap protection enforced transactionally at the database/service layer.
- GPS telemetry is designed as a separate, access-controlled subsystem.
- Subscription limits are enforced by backend services, not only by the UI.

### Initial build scope
This repository starts with the product foundation and architecture. Authentication, billing, transactional booking workflows, email delivery, and GPS integrations will be added in staged, tested increments before production use.

### Status
Early foundation — not production-ready until authentication, tenant authorization, database migrations, operational workflows, and deployment configuration have been completed and tested.
