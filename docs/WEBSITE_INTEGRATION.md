# STS-AI Website Integration Guide

Connect **any website** to an STS-AI workspace — same pattern as Prime One.

You get two independent integrations under one **workspace id**:

| Integration | What it does | What the site needs |
|-------------|--------------|---------------------|
| **Publish** | Pull profile + services for pages/catalog | `workspaceId` + site key |
| **Widget** | Embed chat / voice AI room | `roomName` + site key |

```
Your website
├── Publish API  →  /api/public/v1/workspaces/{workspaceId}/…
└── Widget       →  StsAiRoom (roomName + siteKey)
         ▲
         └── both authenticated with the same embed site key
             (configured under Messages → room → Embed)
```

---

## 1. Prepare in STS-AI (dashboard)

1. Create or open a **Workspace**.
2. **Publish**
   - Enable the outbound modules you want (Core, Industry, Social, Blog).
   - Fill content → **Save Draft** → **Publish context**.
3. **Messages**
   - Attach a room to that workspace.
   - Open the room → **Embed**
   - Set **allowed origin** to your website URL (e.g. `http://localhost:3001` or `https://yoursite.com`).
   - Generate / copy the **site key**.
4. Copy these values from Embed setup:
   - STS AI URL (e.g. `https://app.your-sts.com` or `http://localhost:3000`)
   - `workspaceId`
   - `roomName`
   - site key

> Public identity = **workspace id**.  
> Old “business id” is internal (publish profile) — do not use it on websites.

---

## 2. Environment variables (any Next.js site)

Create `.env.local`:

```bash
# STS-AI app URL
NEXT_PUBLIC_STS_AI_URL=http://localhost:3000

# Workspace (public id for publish + MCP)
NEXT_PUBLIC_STS_WORKSPACE_ID=your-workspace-uuid

# Embed auth (from Messages → Embed)
NEXT_PUBLIC_STS_SITE_KEY=sts_pk_live_…
STS_SITE_KEY=sts_pk_live_…

# Widget room (from Messages)
NEXT_PUBLIC_STS_ROOM_NAME=room-your-agent-xxxxx
```

Restart the site after changing env.

---

## 3. Pass Publish onto a website

### Install

From the STS-AI monorepo (or published package):

```bash
npm install @sts-ai/site-sdk
# or link locally: npm install file:../sts-ai/packages/site-sdk
```

### Fetch profile + services

```ts
// e.g. app/api/content/services/route.ts  (server-side)
import { createStsSiteClient } from '@sts-ai/site-sdk'

const client = createStsSiteClient({
  apiBase: process.env.NEXT_PUBLIC_STS_AI_URL!,
  workspaceId: process.env.NEXT_PUBLIC_STS_WORKSPACE_ID!,
  siteKey: process.env.STS_SITE_KEY!, // prefer server-only key
})

// Published compact profile (name, vertical, core, industry, social, blog…)
const profile = await client.getProfile()

// Services catalog (optional ?type=insurance|tax|…)
const services = await client.getServices('all')
// const insurance = await client.getServices('insurance')
```

### Raw HTTP (no SDK)

```http
GET {STS_AI_URL}/api/public/v1/workspaces/{workspaceId}/profile
GET {STS_AI_URL}/api/public/v1/workspaces/{workspaceId}/services?type=all
Header: X-Sts-Site-Key: sts_pk_live_…
Header: Origin: https://yoursite.com   (must be in allowed origins)
```

### What you typically render

- Home / about → `profile.profile` (compact JSON)
- Services pages → `services.services_by_category`
- Blog blocks → `profile.profile.blog` (if Blog module is on)

Disabled Publish modules are omitted from the public payload.

---

## 4. Pass the Widget onto a website

### Install

```bash
npm install @sts-ai/sudotechserve
```

### Drop-in component

```tsx
import { StsAiRoom } from '@sts-ai/sudotechserve'
import '@sts-ai/sudotechserve/styles.css'

export function AiSupportSection() {
  return (
    <section className="h-[520px] w-full">
      <StsAiRoom
        apiBase={process.env.NEXT_PUBLIC_STS_AI_URL!}
        siteKey={process.env.NEXT_PUBLIC_STS_SITE_KEY!}
        roomName={process.env.NEXT_PUBLIC_STS_ROOM_NAME!}
        embedMode
        defaultTab="voice" // or "chat"
      />
    </section>
  )
}
```

Use on any page (home, contact, support). Visitors talk to the workspace’s AI room — no STS login.

---

## 5. Checklist (new site)

- [ ] Workspace created in STS-AI  
- [ ] Publish content published  
- [ ] Messages room attached to that workspace  
- [ ] Embed enabled + allowed origin = your site URL  
- [ ] Site key copied into `.env.local`  
- [ ] `NEXT_PUBLIC_STS_WORKSPACE_ID` set  
- [ ] `NEXT_PUBLIC_STS_ROOM_NAME` set (widget only)  
- [ ] Site restarted  
- [ ] Profile/services load (Publish)  
- [ ] Widget connects (Messages)

---

## 6. Common mistakes

| Mistake | Fix |
|---------|-----|
| Using old `BUSINESS_ID` | Use `NEXT_PUBLIC_STS_WORKSPACE_ID` |
| Calling `/api/public/v1/businesses/…` | Use `/api/public/v1/workspaces/{workspaceId}/…` |
| CORS / blocked Origin | Add your site URL in Messages → Embed → allowed origins |
| Empty services | Publish Industry module + **Publish context** in STS-AI |
| Widget fails, Publish works | Check `ROOM_NAME` and that room belongs to the same workspace |
| Wrong site key | Rotate key in Embed and update both `NEXT_PUBLIC_STS_SITE_KEY` and `STS_SITE_KEY` |

---

## 7. Optional: MCP (advanced)

If the site also needs MCP resources (like Prime One contact/proxy):

```bash
MCP_TENANT_ID=same-as-workspace-id
MCP_JSONRPC_URL={STS_AI_URL}/api/mcp/jsonrpc
MCP_HANDSHAKE_URL={STS_AI_URL}/api/mcp/handshake
MCP_ALLOWED_DOMAIN=https://yoursite.com
MCP_BEARER_TOKEN=…   # from STS MCP handshake / issued token
```

`MCP_TENANT_ID` **is the workspace id**.

See also: `docs/MCP_EXTERNAL_WEBSITE_POC.md`.

---

## 8. Mental model

```
Workspace  (public id for other websites)
├── Publish   → profile + services APIs
├── Partners  → MCP connectors (optional)
├── Messages  → rooms + embed widget
├── Product / Webinar (optional)
```

Other websites only hold:

1. `workspaceId`  
2. `siteKey`  
3. `roomName` (if using the widget)
