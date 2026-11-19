# Platform management

The platform console allows authorized ROAM administrators to maintain plan metadata and assign subscription tiers to tenant workspaces.

## Billing boundary

Plan prices in ROAM are catalog metadata only. The current implementation does not integrate a payment processor, collect card details, issue invoices, charge customers, or automatically renew subscriptions. New manual assignments are marked for billing review. Confirm payment through an approved process before representing an account as paid.

## Operational safeguards

- Every management API request checks the configured platform-admin identity on the server.
- Tenant plan assignment changes the plan and its entitlement limits.
- Production database changes and deployments remain gated on review and explicit approval.
