# Lead Call Intelligence

Independent `/lead` hub (not the projects attendee table). Joins data by **email**.

## What it does

1. **First visit → Setup** — connect Fathom, Google Calendar, pick an `/ai-agents` rulebook, multi-select projects
2. **After setup → Today’s list** — calendar sales events as expandable rows (form, research, Fathom summary, score, notes)
3. **7 AM cron** — builds briefs/research for tagged events (only for users who finished setup)
4. **Cross-check** — Fathom **summary** vs selected agent `systemPrompt`

## Connectors

### Fathom

1. Create an API key in Fathom → Settings → API Access
2. On `/lead` → Connectors → paste key → Connect  
   App validates the key, stores it encrypted, and attempts to register a webhook at:

   `{NEXT_PUBLIC_APP_URL}/api/webhooks/fathom?userId={yourUserId}`

3. Use **Sync recent** to backfill the last meetings manually

### Google Calendar

1. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
2. Redirect URI: `{origin}/api/integrations/google-calendar/callback`  
   Or override with `GOOGLE_REDIRECT_URI`
3. Click **Connect Calendar** on `/lead`
4. Tag sales events so they are scanned:
   - Title/description contains `[Sales]`, or
   - Contains `sales call`, or
   - Title starts with `Sales:`

### /ai-agents rules

Create a dedicated LiveKit agent under `/ai-agents` with the sales script / behavior rules in **system prompt**. On each Lead card, select that agent. Scoring compares the Fathom **summary** to those rules.

### Project form

Looked up via `Attendee.email` for webinars you present. Today forms are **name + email** only (no custom answers field).

## Environment

```bash
# Required for scoring / research synthesis
GOOGLE_API_KEY=...

# Fathom key is stored per-user in DB (not env)

# Google Calendar OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
# optional override:
# GOOGLE_REDIRECT_URI=https://your-domain/api/integrations/google-calendar/callback

# Web research
# Default (free): Gemini Google Search grounding via GOOGLE_API_KEY
# Optional (per creator in /lead setup, or env fallback):
# SERPER_API_KEY=...

# Daily cron auth (Vercel Cron sends Authorization: Bearer …)
CRON_SECRET=long-random-string

# App URL for Fathom webhook destination
NEXT_PUBLIC_APP_URL=https://your-domain
# Also accepted: NEXT_PUBLIC_BASE_URL (already used in this repo)

# Existing encryption for stored tokens
ENCRYPTION_KEY=64-char-hex
```

## Cron

[`vercel.json`](../vercel.json) schedules:

`0 1 * * *` → `GET /api/cron/lead-intel`  
(01:00 UTC ≈ **07:00 Asia/Dhaka**)

Authorize with:

```http
Authorization: Bearer $CRON_SECRET
```

### What the 7am job does automatically

1. Sync recent Fathom meetings (last 3 days)
2. Attach your default AI agent to leads that need it
3. **Score** every meeting that has a summary + agent but no score yet
4. **Web research** calendar leads for today, plus any meeting-linked leads still missing a dossier

### Manual Sync Fathom (instant Meets)

**Sync Fathom** only ingests recordings. After a manual sync you still click **Run score** / **Refresh** research on that lead — by design, so instant calls don’t burn API quota until you review them.

### Coolify / Hostinger VPS (Docker)

Vercel cron does **not** run inside Coolify. Schedule an HTTP job (Coolify “Scheduled Task”, system crontab, or Healthcheck cron) daily at **01:00 UTC**:

```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
  https://your-domain/api/cron/lead-intel
```

App image: root [`Dockerfile`](../Dockerfile) + [`.dockerignore`](../.dockerignore). Set `CRON_SECRET`, DB, Clerk, and Gemini keys in Coolify env.

Manual test:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/lead-intel
```

## Matching limits

- Primary join key is **email**
- Instant Meets without guest email create a **synthetic** `name@fathom.local` lead from the first non-host speaker (never the Fathom account owner)
- If a real guest email appears later, same-name synthetic leads are merged into the real email lead
- Location / social flags from web research are **estimates** — verify before acting

## Migration

```bash
npx prisma migrate deploy
# or
npx prisma migrate dev
```

Migration folder: `prisma/migrations/20260721010000_call_intel`
