# ROAM browser push notifications

ROAM uses the standard Web Push API and a service worker. It does not require a WebSocket service or a paid realtime add-on.

## Vercel environment variables

Set these for Preview and Production:

- `WEB_PUSH_VAPID_PUBLIC_KEY`: base64url-encoded uncompressed P-256 public key (65 bytes).
- `WEB_PUSH_VAPID_PRIVATE_KEY`: base64url-encoded P-256 private scalar (32 bytes). Keep this secret; never expose it with a `NEXT_PUBLIC_` prefix.
- `WEB_PUSH_SUBJECT`: a monitored `mailto:` contact for push-service abuse reports.

Generate a matching key pair with Node.js:

```js
const { createECDH } = require("node:crypto");
const ecdh = createECDH("prime256v1");
ecdh.generateKeys();
console.log("WEB_PUSH_VAPID_PUBLIC_KEY=" + ecdh.getPublicKey(undefined, "uncompressed").toString("base64url"));
console.log("WEB_PUSH_VAPID_PRIVATE_KEY=" + ecdh.getPrivateKey().toString("base64url"));
```

Do not rotate the VAPID key pair after users subscribe unless you are prepared to have them re-enable notifications.

## Database

Deploy the Prisma migration `20261123000000_web_push_subscriptions` before enabling the feature in production. Then run `prisma generate` as part of the normal build.

## Browser support

Push requires HTTPS and explicit permission. On iOS/iPadOS, web push is available to web apps added to the Home Screen on supported OS versions; open ROAM in Safari, choose Share, then Add to Home Screen before enabling notifications. Browser settings can revoke permission at any time.

## Events

- New booking requests and customer messages notify subscribed workspace devices.
- Booking status changes and rental-team messages notify subscribed customer devices.
- Payment proof submissions notify workspace devices.
- Payment approval/rejection notifies customer devices.

Push messages contain minimal booking information. Delivery is best-effort; email remains the fallback channel.
