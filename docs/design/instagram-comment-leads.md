# Instagram comments → leads (built into sts-ai)

Status: plan, not started. Written 2026-11-22.

## Goal

A creator connects Instagram once in sts-ai, picks a post or reel and a keyword ("PRICE", "LINK",
"দাম"), and from then on:

1. Anyone who comments that keyword gets a DM from the creator's account (and, optionally, a public
   reply under the comment).
2. That person becomes a lead in `/lead/list`, labelled **Instagram**, with their username, the
   comment and the campaign.
3. The DM asks for an email or WhatsApp number. When they answer, the lead gets it, and the usual
   background check runs when the creator opens the lead.

Creators install nothing. sts-ai owns one Meta app; each creator only clicks **Connect Instagram**.

## Why not OpenReply as a service

[OpenReply](https://github.com/diwennee/openreply) (MIT) does steps 1 well, but every creator would
have to self-host it (app + worker + Postgres + Redis + public HTTPS + their own reviewed Meta app or
paid Zernio), and its API exposes only campaign stats, never who commented. We borrow its ideas and,
where useful, its code (keep its MIT notice in any file adapted from it).

Worth reading there: `lib/meta/oauth.ts`, `lib/meta/webhook.ts`, `lib/meta/client.ts`,
`lib/instagram/send-messages.ts`, `lib/instagram/delivery-errors.ts`, `lib/queue/process-webhook.ts`,
`lib/queue/comment-delivery.ts`, `app/api/cron/refresh-tokens/route.ts`.

## What the platform owner does once (not code)

1. Create a Meta developer app with **Instagram API with Instagram Login**.
2. Add the webhook URL `https://<app domain>/api/instagram/webhook` with a verify token, and
   subscribe the `comments` and `messages` fields.
3. Put `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` in the server env.
4. Until App Review: only Instagram accounts added as testers on the app can connect (enough to
   build and test with your own accounts).
5. For every creator to connect: App Review for `instagram_business_basic`,
   `instagram_business_manage_comments`, `instagram_business_manage_messages`, plus Meta
   **business verification**. This takes calendar time (often 1–4 weeks), not code.

Creators need an Instagram **Business or Creator** account. A creator coming from ManyChat must
disconnect it first, or DM buttons fail with "not the thread owner".

## Design

Follows the Telegram integration's shape (`src/lib/telegram/*`, `src/app/api/telegram/webhook`).

### Data (one migration)

- `InstagramConnection` — per creator: IG user id, username, long-lived token (encrypted with the
  existing `encryptToken`), token expiry, webhook-subscribed flag.
- `InstagramCampaign` — connection, media id (post/reel) or "any post", keywords, match mode
  (whole word / contains), DM text with `{username}`, optional link, optional public reply text,
  ask-for-contact on/off, active flag.
- `InstagramDmJob` — the send queue and log in one table: comment id (unique per campaign, for
  dedup), commenter IG id + username, comment text, status (`PENDING` / `SENT` / `SKIPPED` /
  `FAILED`), attempts, next attempt time, error, lead id.
- `CallIntelLead` gets `instagramUserId` and `instagramUsername` (indexed per user). Instagram leads
  use `source = 'IMPORT'`, `importApp = 'INSTAGRAM'` and a stand-in email
  `ig-<igUserId>@import.local`, so the existing fake-email handling (not shown, not searched,
  replaced when a real one arrives) works unchanged.

### Server

- `src/lib/instagram/graphApi.ts` — thin fetch client for `graph.instagram.com`, explicit timeouts.
- `src/lib/instagram/oauth.ts` + `src/app/api/instagram/{connect,callback}/route.ts` — Instagram
  Login, short → long-lived token, subscribe the account to the app's webhooks.
- `src/app/api/instagram/webhook/route.ts` — `GET` answers Meta's verify challenge; `POST` checks
  `X-Hub-Signature-256` with the app secret, then hands off to `src/lib/instagram/webhook.ts`, which
  maps `entry.id` to the creator, ignores the creator's own comments, matches campaigns, and
  inserts `InstagramDmJob` rows. The route answers 200 at once.
- `src/lib/instagram/sendQueue.ts` — sends due jobs: the **private reply** (`recipient.comment_id`),
  then the optional public reply; per-account cap under Meta's 750 private replies/hour; retries with
  backoff; marks permanent errors as `FAILED` with a readable reason. Kicked right after the webhook
  (`after()`) and by `/api/cron/instagram` every minute as a safety net.
- `src/lib/instagram/leads.ts` — upserts the lead by `instagramUserId` (one lead per person per
  creator, comments from the same person merge).
- Contact capture: when the `messages` webhook brings a reply from someone with a pending lead,
  pull an email or phone out of the text (regex first, model only if unclear), write it to the lead,
  and thank them. Only inside Meta's 24-hour window after their last message.
- `/api/cron/instagram` also refreshes long-lived tokens before their 60-day expiry.

### Screens (same look as today)

- `/integrations/instagram` — Connect / Disconnect, account shown, token health.
- Campaigns — on the same page: pick a recent post (thumbnails from the API), keywords, DM text,
  options, on/off, and per-campaign counts (comments matched, DMs sent, contacts captured).
- `/lead/list` — Instagram leads labelled **Instagram**; filter by campaign.
- Lead details — the comment, the campaign, and the DM exchange; the background check uses the
  captured email/phone, and the DM text as context when the web has nothing.

## Phases

| # | Ships | Size |
|---|---|---|
| 1 | Connect Instagram, token storage + refresh, webhook verified and signed | ~2 days |
| 2 | Keyword campaigns, private + public reply, send queue, DM log | ~2–3 days |
| 3 | Commenters become leads; list label, campaign filter, details panel | ~1 day |
| 4 | Contact capture in DMs; background check uses it | ~2 days |

Phases 1–3 are useful alone. Meta review can run in parallel with phases 1–3.

## Load on the running app

Light. Per comment: one small webhook request, a signature check, a few row writes, one or two
Meta API calls. No Redis, no new worker process, no new npm packages (fetch + node crypto). One
cron route every minute. The heaviest part is Meta's review process, not the code.

## Risks and rules to respect

- Private replies: one per comment, only to comments on the creator's own media, within 7 days.
- Follow-up DMs only inside the 24-hour window after the person writes.
- Rate limits per account; queue overflow, never drop.
- Token expiry (60 days) — refresh job plus a "reconnect" state on the integration page.
- Bangla: keyword matching and DM text must be Unicode-safe (normalise case only, never strip
  marks; test `দাম`, `দাম?`, mixed Bangla/English).
- Privacy: store only what the lead needs (IG id, username, comment, DM replies), delete on
  disconnect if the creator asks.
