# Smoke tests

The 5 critical journeys, tested against a running app. Each group skips itself when its secrets are missing.

```bash
SMOKE_BASE_URL=http://localhost:3000 npm run test:smoke
```

| Group | File | Needs |
|---|---|---|
| Public: health + DB, sign-in renders, logged-out redirect and 401, unknown offer is 404, chat and voice reject bad input | `public.smoke.ts` | nothing |
| Stripe webhook: unsigned is rejected, signed is accepted (ignored event type, no data change) | `stripe-webhook.smoke.ts` | `STRIPE_WEBHOOK_SECRET` (same as the app's) |
| Signed in: dashboard + user API, LiveKit token, offer link | `signed-in.smoke.ts` | `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` (dev instance), `E2E_CLERK_USER_EMAIL`; optional `E2E_ROOM_NAME`, `E2E_OFFER_SLUG` |

Signed-in tests use Clerk's backend sign-in token, so no password is stored. They only work with a Clerk **development** instance (`pk_test`/`sk_test`).

Where they run:
- **CI** (every PR): all groups whose secrets are set as GitHub secrets.
- **`scripts/deploy.sh`**: against the new container through an SSH tunnel, before it takes traffic.
- **Locally**: against `npm run dev` or `npm run start`.
