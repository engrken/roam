# Platform management

The platform console is available at `/admin` after signing in to ROAM with an authorized platform-admin account.

## Platform administrator access

Platform-admin access is controlled server-side by the `ROAM_ADMIN_EMAILS` environment variable. Set it to one or more exact ROAM account email addresses, separated by commas. Matching is case-insensitive and whitespace is trimmed.

In Vercel, open the ROAM project → Settings → Environment Variables and add `ROAM_ADMIN_EMAILS` for the environments that should have admin access. Use the exact email address registered to the administrator's ROAM account. Redeploy after changing the value so the server runtime receives it. Never expose this setting with a `NEXT_PUBLIC_` prefix. Do not create an automatic first-user administrator or allow users to grant themselves platform access.

## Console capabilities

- Tenant management: review tenant registrations, usage, and status; activate, suspend, or cancel tenant workspaces.
- Plans and subscriptions: edit plan catalog metadata and resource limits, and assign an active plan to a tenant.
- Audit history: review the latest platform-level administrative changes.
- Workspace operations: tenant owners and administrators can manage their own team, business profile, and operational reports.

## Billing boundary

Plan prices in ROAM are catalog metadata only. The current implementation does not integrate a payment processor, collect card details, issue invoices, charge customers, or automatically renew subscriptions. New manual assignments are marked for billing review. Confirm payment through an approved process before representing an account as paid.

## Operational safeguards

- Every management API request checks the configured platform-admin identity on the server.
- Tenant plan assignment changes the plan and its entitlement limits.
- Suspended and cancelled tenants are blocked from workspace access.
- The platform audit table is created by an additive migration; apply it only through the reviewed deployment process.
- Production database changes and deployments remain gated on review and explicit approval.
