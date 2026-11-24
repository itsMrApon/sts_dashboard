export type CliPromptKind = 'setup' | 'sync'

export type PartnerCliPromptContext = {
  kind: string
  label: string
  workspaceId: string | null
  workspaceName: string | null
  publishProfileId: string | null
  mcpUrl: string
  appBaseUrl: string
  connected: boolean
}

type PartnerPromptSpec = {
  defaultPort: string
  detectHint: string
  dockerHint: string
  syncGoal: string
  setupGoal: string
}

const SPECS: Record<string, PartnerPromptSpec> = {
  medusa: {
    defaultPort: '9001',
    detectHint:
      'Check whether Medusa.js is reachable at the MCP/app URL (Admin/Store API). Typical local URL: http://localhost:9001',
    dockerHint:
      'If Medusa is missing, create/update a Docker Compose (or local) Medusa 2.x stack on port 9001, then create an Admin API token.',
    setupGoal:
      'Install/start Medusa, obtain an Admin API token, and tell the creator the exact URL + token to paste into STS Partners → Medusa connector.',
    syncGoal:
      'Read the STS workspace publish profile (name, services, social, pricing) and sync catalog/store settings into Medusa (create/update products or store metadata that match the creator profile). Do not invent secret credentials.',
  },
  erpnext: {
    defaultPort: '8080',
    detectHint:
      'Check whether ERPNext/Frappe is reachable (typical local URL: http://localhost:8080). URY POS may share this stack.',
    dockerHint:
      'If ERPNext is missing, guide installing/starting ERPNext via Docker (or frappe_docker) on port 8080 and create an API Key/Secret.',
    setupGoal:
      'Install/start ERPNext, create API credentials (key:secret), and tell the creator the URL + credentials to paste into STS Partners → ERPNext connector.',
    syncGoal:
      'Read the STS workspace publish profile and sync business identity into ERPNext (Company/Customer/Items as appropriate — e.g. menu items like coffee). Prefer upsert; never wipe production data without confirmation.',
  },
  n8n: {
    defaultPort: '5678',
    detectHint:
      'Check whether n8n is reachable (UI: http://localhost:5678). Prefer MCP at /mcp when available; otherwise use REST API + /webhook/.',
    dockerHint:
      'If n8n is missing, create/start an n8n Docker container on port 5678 and create an API key (and optional webhook paths).',
    setupGoal:
      'Install/start n8n, create an API key, optionally scaffold a starter workflow for this workspace, and tell the creator the URL + key to paste into STS Partners → n8n connector.',
    syncGoal:
      'Read the STS workspace publish profile and create/update an n8n workflow (or webhook script) that uses that profile — e.g. social posting / lead ingest. If a social script already exists, update it; otherwise create a new one named for this workspace.',
  },
  firecrawl: {
    defaultPort: '',
    detectHint: 'Check Firecrawl MCP reachability at the configured MCP URL.',
    dockerHint: 'If Firecrawl MCP is unavailable, guide obtaining a Firecrawl API/MCP endpoint.',
    setupGoal: 'Connect Firecrawl MCP credentials and report the URL to paste into STS Partners.',
    syncGoal:
      'Use Firecrawl to crawl the creator site (from STS links/profile) and summarize pages that should update the publish profile.',
  },
  openseo: {
    defaultPort: '3001',
    detectHint:
      'Check whether OpenSEO is reachable (UI: http://localhost:3001, MCP at /mcp, health at /api/health). The creator signs in there and creates an API key under Settings → API keys (starts with oseo_).',
    dockerHint:
      'If OpenSEO is missing, set it up with Docker Compose from https://github.com/every-app/open-seo (docs/SELF_HOSTING_DOCKER.md): deploy/standalone/compose.yaml, STORAGE_SECRET_KEY and DATAFORSEO_API_KEY in deploy/standalone/.env, then docker compose up -d. sts-ai runs on a server, so the MCP URL must be reachable from the internet (for example a named Cloudflare Tunnel), and BETTER_AUTH_URL must match that https address.',
    setupGoal:
      'Start OpenSEO, create an API key (oseo_…), and tell the creator the public MCP URL (ending in /mcp) and the key to paste into STS Partners → OpenSEO, with auth type Bearer.',
    syncGoal:
      'Read the STS workspace publish profile (business, location, services) and create an OpenSEO project for its website with the business context, so keyword and local SEO research has the right focus.',
  },
  custom: {
    defaultPort: '',
    detectHint: 'Probe the custom MCP URL with an MCP initialize handshake.',
    dockerHint: 'If the MCP server is missing, help the creator run or dockerize that MCP server.',
    setupGoal: 'Bring the custom MCP server online and report the URL for STS Partners.',
    syncGoal:
      'Read STS workspace profile via MCP and call the custom MCP tools needed to sync that profile into the external system.',
  },
}

function specFor(kind: string): PartnerPromptSpec {
  return SPECS[kind] || SPECS.custom
}

function stsEndpoints(appBaseUrl: string) {
  const base = appBaseUrl.replace(/\/$/, '')
  return {
    handshake: `${base}/api/mcp/handshake`,
    jsonrpc: `${base}/api/mcp/jsonrpc`,
    partnersCatalog: `${base}/tenants`,
    partnersPage: `${base}/tenants/partners`,
    assistant: `${base}/api/tenants/assistant`,
  }
}

function sharedPreamble(ctx: PartnerCliPromptContext): string {
  const endpoints = stsEndpoints(ctx.appBaseUrl)
  return [
    `# STS-AI partner agent brief — ${ctx.label}`,
    '',
    'You are helping a creator connect their STS-AI workspace to an open-source partner app.',
    '',
    '## Workspace',
    `- Workspace name: ${ctx.workspaceName || '(unknown)'}`,
    `- Workspace ID (tenantId): ${ctx.workspaceId || '(missing — ask creator to open Partners with a workspace selected)'}`,
    `- Publish profile ID: ${ctx.publishProfileId || '(none linked yet)'}`,
    `- Partner kind: ${ctx.kind}`,
    `- Partner MCP/app URL: ${ctx.mcpUrl || '(not set)'}`,
    `- Connector status: ${ctx.connected ? 'CONNECTED in STS Partners' : 'NOT CONNECTED yet in STS Partners'}`,
    '',
    '## STS app APIs (this creator\'s STS instance)',
    `- Partners catalog: ${endpoints.partnersCatalog}`,
    `- Integration page: ${endpoints.partnersPage}?tenantId=${ctx.workspaceId || ''}&kind=${ctx.kind}`,
    `- MCP handshake: POST ${endpoints.handshake}  body: { "tenantId": "<workspaceId>", "domain": "<origin-or-localhost>" }`,
    `- MCP JSON-RPC: POST ${endpoints.jsonrpc}  (use token from handshake; resources like core/compact, industry/compact, social/compact, services/list, pricing, links)`,
    `- Workspace chat assistant: POST ${endpoints.assistant}`,
    '',
    '## Hard rules',
    '1. Never invent API secrets. Ask the creator or read from local env/files they already have.',
    '2. If the partner app is not installed/running, STOP sync work and tell them clearly to install + connect it in STS Partners first.',
    '3. Prefer idempotent upserts. Confirm before destructive deletes.',
    '4. Keep Bangla/Unicode profile text intact — do not ASCII-normalize.',
    '5. After success, summarize exact URLs, ports, and what to paste into STS Partners.',
  ].join('\n')
}

export function buildPartnerSetupPrompt(ctx: PartnerCliPromptContext): string {
  const spec = specFor(ctx.kind)
  return [
    sharedPreamble(ctx),
    '',
    '## Task: SETUP',
    spec.setupGoal,
    '',
    '### Steps',
    `1. ${spec.detectHint}`,
    `2. ${spec.dockerHint}`,
    '3. Verify health (HTTP 200 / MCP initialize / Admin API ping).',
    '4. Create credentials if needed (API token / key:secret).',
    '5. Output a short checklist for the creator:',
    '   - MCP/App URL to paste',
    '   - Auth secret to paste',
    `   - Stay on the STS integration page, scroll to **Engineered for constraints.**, paste URL + secret, then Connect ${ctx.label}`,
    `   - Partners URL: ${stsEndpoints(ctx.appBaseUrl).partnersPage}?tenantId=${ctx.workspaceId || ''}&kind=${ctx.kind}`,
    '6. If you create files (docker-compose, .env.example, scripts), put them in a sensible local folder and show the commands to run.',
  ].join('\n')
}

export function buildPartnerSyncPrompt(ctx: PartnerCliPromptContext): string {
  const spec = specFor(ctx.kind)
  return [
    sharedPreamble(ctx),
    '',
    '## Task: SYNC PROFILE → PARTNER',
    spec.syncGoal,
    '',
    '### Steps',
    `1. ${spec.detectHint}`,
    `2. If NOT reachable: reply exactly with a clear message like: "You don't have ${ctx.label} installed/running. Please install it and connect it in STS Partners first." Then stop.`,
    '3. If STS workspaceId is present, call MCP handshake + read resources: core/compact, industry/compact, social/compact, services/list, pricing, links.',
    '4. If handshake fails (unauthenticated), ask the creator to stay signed in to STS in the browser, or paste a compact profile JSON manually.',
    `5. Map profile fields into ${ctx.label} objects and upsert.`,
    `6. Partner endpoint to use: ${ctx.mcpUrl || '(ask creator for URL)'}`,
    '7. Finish with a report: what was created/updated, IDs, and any manual follow-ups.',
  ].join('\n')
}

export function buildPartnerCliPrompts(ctx: PartnerCliPromptContext): {
  setup: string
  sync: string
} {
  return {
    setup: buildPartnerSetupPrompt(ctx),
    sync: buildPartnerSyncPrompt(ctx),
  }
}
