# n8n Workflow Setup Guide

All workflows run in the local n8n instance at `http://localhost:5678`.
Open the n8n UI, create each workflow, and wire the nodes as described below.

**Update (tenants):** In-app **campaign launch**, **`/api/campaigns/ingest`**, **`/api/campaigns/update-state`**, and **`/api/campaigns/track-click`** have been removed. Use **Tenants → Send context to n8n** in the app (or call your own workflow) with env **`N8N_TENANT_WEBHOOK_URL`** (or legacy **`N8N_CAMPAIGN_WEBHOOK_URL`**). Payload includes `tenantId`, `userId`, `businessId`, `business`, and `tenant` objects. **`/api/events/ingest`** still accepts **`tenantId`** (and still accepts deprecated **`campaignId`** as an alias).

---

## Workflow 1: Campaign Launch (deprecated in app)

This workflow is triggered when a user clicks "Launch Campaign" in the app.
It scrapes leads, saves them, and sends outreach messages.

### Nodes

#### 1. Webhook (Trigger)
- **Method:** POST
- **Path:** `campaign-launch`
- After saving, copy the **Production Webhook URL** shown by n8n.
  It should be: `http://localhost:5678/webhook/campaign-launch`

#### 2. HTTP Request — Outscraper Scrape
- **Method:** GET
- **URL:** `https://api.app.outscraper.com/maps/search-v3`
- **Headers:**
  - `X-API-KEY` = `{{$env.OUTSCRAPER_API_KEY}}`
- **Query Params:**
  - `query` = `{{$json.niche}} {{$json.location}}`
  - `limit` = `20`
  - `language` = `en`

#### 3. Code Node — Map to Lead Array
```javascript
const items = $input.all()
return items[0].json.data.map(item => ({
  json: {
    name: item.name || '',
    email: item.email_1 || '',
    phone: item.phone || '',
    website: item.site || '',
    address: item.full_address || '',
    businessName: item.name || '',
    source: 'GOOGLE_MAPS',
    niche: $('Webhook').first().json.niche,
    location: $('Webhook').first().json.location,
    rawData: item
  }
}))
```

#### 4. HTTP Request — Save Leads
- **Method:** POST
- **URL:** `{{$env.APP_URL}}/api/campaigns/ingest`
- **Headers:**
  - `Content-Type` = `application/json`
  - `x-api-key` = `{{$env.N8N_API_KEY}}`
- **Body (JSON):**
```json
{
  "campaignId": "{{$('Webhook').first().json.campaignId}}",
  "userId": "{{$('Webhook').first().json.userId}}",
  "leads": "{{$json}}"
}
```
The response includes `savedLeads` with `campaignLeadId` for each.

#### 5. Split in Batches
- **Batch Size:** 1
- Process one lead at a time to avoid rate limits.

#### 6. Code Node — Build Outreach Message
```javascript
const lead = $input.first().json
const webhook = $('Webhook').first().json
let msg = webhook.pitchMessage
  .replace('{name}', lead.name)
  .replace('{businessName}', lead.businessName)
if (webhook.videoUrl) {
  msg += '\n\n🎥 Watch: ' + webhook.videoUrl
}
if (lead.campaignLeadId) {
  msg += '\n\n👉 ' + webhook.trackingBaseUrl + lead.campaignLeadId
}
return [{ json: { ...lead, message: msg } }]
```

#### 7. IF Node — Email Channel
- **Condition:** `{{$('Webhook').first().json.useEmail}}` equals `true`
  AND `{{$json.email}}` is not empty

**True branch:**

- **Gmail Node — Send Email**
  - **To:** `{{$json.email}}`
  - **Subject:** `Quick question about {{$json.businessName}}`
  - **Body:** `{{$json.message}}`
  - (Configure Gmail credentials in n8n Settings > Credentials)

- **HTTP Request — Update State**
  - POST `{{$env.APP_URL}}/api/campaigns/update-state`
  - Headers: `x-api-key` = `{{$env.N8N_API_KEY}}`
  - Body: `{ "campaignLeadId": "{{$json.campaignLeadId}}", "userId": "{{$('Webhook').first().json.userId}}", "channel": "email", "status": "SENT", "sentAt": "{{$now.toISO()}}" }`

- **HTTP Request — Fire Event**
  - POST `{{$env.APP_URL}}/api/events/ingest`
  - Headers: `x-api-key` = `{{$env.N8N_API_KEY}}`
  - Body: `{ "userId": "{{$('Webhook').first().json.userId}}", "eventType": "OUTREACH_SENT", "campaignId": "{{$('Webhook').first().json.campaignId}}", "channel": "email" }`

#### 8. IF Node — Telegram Channel
- **Condition:** `{{$('Webhook').first().json.useTelegram}}` equals `true`
  AND `{{$json.telegramId}}` is not empty

**True branch:**

- **HTTP Request — Telegram sendMessage**
  - POST `https://api.telegram.org/bot{{$('Webhook').first().json.telegramBotToken}}/sendMessage`
  - Body: `{ "chat_id": "{{$json.telegramId}}", "text": "{{$json.message}}" }`

- **HTTP Request — Update State**
  - POST `{{$env.APP_URL}}/api/campaigns/update-state`
  - Headers: `x-api-key` = `{{$env.N8N_API_KEY}}`
  - Body: `{ "campaignLeadId": "{{$json.campaignLeadId}}", "userId": "{{$('Webhook').first().json.userId}}", "channel": "telegram", "status": "SENT", "sentAt": "{{$now.toISO()}}" }`

#### 9. Wait Node
- **Duration:** 30 minutes
- Prevents spam — adds delay between each lead's outreach.

---

## Workflow 2: Lead Hunt (Standalone)

A lighter workflow for hunting leads without sending outreach.

### Nodes

#### 1. Webhook (Trigger)
- **Method:** POST
- **Path:** `lead-hunt`
- URL: `http://localhost:5678/webhook/lead-hunt`

#### 2. HTTP Request — Outscraper Scrape
Same as Workflow 1, Step 2.

#### 3. Code Node — Map to Lead Array
Same as Workflow 1, Step 3. But use `$('Webhook')` to read niche/location.

#### 4. HTTP Request — Save Leads
Same as Workflow 1, Step 4.
(No campaignId needed — pass empty string or omit.)

No outreach nodes — just save and score the leads.

---

## Workflow 3: Daily Summary (Optional)

Sends a daily email digest of campaign performance.

### Nodes

#### 1. Schedule Trigger
- **Cron:** Every day at 8:00 AM

#### 2. HTTP Request — Get Summary
- **Method:** GET
- **URL:** `{{$env.APP_URL}}/api/analytics/summary`
- **Headers:** `x-api-key` = `{{$env.N8N_API_KEY}}`
- (Build this route later when ready)

#### 3. Gmail Node — Send Summary
- **To:** your email
- **Subject:** `Daily Campaign Summary — {{$now.format('MMM d, yyyy')}}`
- **Body:** `{{$json.summary}}`

---

## Environment Variables for n8n

Set these in the n8n UI at **Settings > Environment Variables**
(or pass them via Docker `-e` flags):

| Variable | Value |
|---|---|
| `APP_URL` | `http://host.docker.internal:3000` (or your ngrok URL) |
| `N8N_API_KEY` | Same key as in your Next.js `.env` |
| `OUTSCRAPER_API_KEY` | From app.outscraper.com (when ready) |

> **Note:** Use `host.docker.internal` instead of `localhost` when n8n
> runs in Docker and your Next.js app runs on the host machine.

---

## Testing

1. Start n8n: `docker run -it --rm --name n8n -p 5678:5678 -v n8n_data:/home/node/.n8n docker.n8n.io/n8nio/n8n`
2. Open `http://localhost:5678`
3. Create each workflow and activate it
4. Test Workflow 2 first (Lead Hunt) — it's the simplest
5. Then test Workflow 1 (Campaign Launch) from the app UI
