import type { PartnerCliPromptContext } from '@/lib/partners/cliPrompts'
import { PARTNER_PRESETS } from '@/lib/partners/partnerPresets'

export type IntegrationPromptVariant = 'cursor' | 'claude' | 'cli' | 'universal'
export type IntegrationPromptStage = 'install' | 'connect' | 'test'

export type IntegrationPromptSet = {
  cursor: string
  claude: string
  cli: string
  universal: string
}

export type IntegrationAiPrompts = {
  install: IntegrationPromptSet
  connect: IntegrationPromptSet
  test: IntegrationPromptSet
}

type PartnerRecipe = {
  product: string
  runtimes: string[]
  defaultUrl: string
  defaultPort: string
  dockerCommand: string
  npmCommand: string
  detectHint: string
  healthCheck: string
  credentialHow: string
  authPasteFormat: string
  authHeader: string
  chatCommands: string[]
  testInChat: string
  presetSync: string
  inbound: string
  outbound: string
}

const RECIPES: Record<string, PartnerRecipe> = {
  medusa: {
    product: 'Medusa.js',
    runtimes: ['Docker Desktop or Docker Engine + Compose', 'Node.js 20+ (npm fallback)'],
    defaultUrl: 'http://localhost:9001',
    defaultPort: '9001',
    dockerCommand:
      'docker compose up -d postgres redis && npx create-medusa-app@latest --skip-db --db-url postgres://postgres:postgres@localhost:5432/medusa',
    npmCommand: 'npx create-medusa-app@latest',
    detectHint:
      'Probe http://localhost:9001/health and http://localhost:9000/health. Reuse a running Medusa Admin instead of reinstalling.',
    healthCheck: 'Admin/Store API returns HTTP 200. Then create an Admin API token.',
    credentialHow:
      'In Medusa Admin: Settings → Secret API Keys (or Users → API key). Create a secret key with Admin permissions.',
    authPasteFormat: 'Medusa Admin API token (Bearer)',
    authHeader: 'Authorization: Bearer <admin_api_token>',
    chatCommands: ['/medusa', '/ecommerce'],
    testInChat:
      'In STS workspace chat, run `/medusa` then ask for products or a sales summary (`medusa_list_products`, `medusa_list_orders`).',
    presetSync:
      'Read this STS workspace publish profile (name, services, pricing) and upsert matching Medusa products/store metadata. Prefer upsert. Do not wipe the catalog.',
    inbound:
      'Inbound: STS chat reads Medusa orders, catalog, and low-stock via the connected Admin API.',
    outbound:
      'Outbound: STS chat can push catalog/profile updates into Medusa after the connector is live.',
  },
  erpnext: {
    product: 'ERPNext',
    runtimes: ['Docker Desktop or Docker Engine + Compose', 'Frappe bench (fallback)'],
    defaultUrl: 'http://localhost:8080',
    defaultPort: '8080',
    dockerCommand:
      'git clone https://github.com/frappe/frappe_docker && cd frappe_docker && cp example.env .env && docker compose -f pwd.yml up -d',
    npmCommand:
      'bench init frappe-bench && cd frappe-bench && bench get-app erpnext && bench new-site erp.localhost --install-app erpnext',
    detectHint:
      'Probe http://localhost:8080. Reuse a running Frappe/ERPNext site. URY POS may share this stack.',
    healthCheck: 'Site login page loads. Then create API Key + API Secret on a user.',
    credentialHow:
      'In ERPNext: User → API Access → Generate Keys. Paste as `api_key:api_secret`.',
    authPasteFormat: 'api_key:api_secret',
    authHeader: 'Authorization: token <api_key>:<api_secret>',
    chatCommands: ['/erpnext', '/erp'],
    testInChat:
      'In STS workspace chat, run `/erpnext` then find an item or list open invoices (`erpnext_find_item`, `erpnext_list_open_invoices`).',
    presetSync:
      'Upsert Company / Customer / Items from this STS publish profile (e.g. menu items). Never wipe production doctypes without confirmation.',
    inbound:
      'Inbound: STS chat reads ERPNext items, stock, and POS/invoices from the connected site.',
    outbound:
      'Outbound: STS chat can create POS drafts or sync profile items into ERPNext after connect.',
  },
  n8n: {
    product: 'n8n',
    runtimes: ['Docker Desktop or Docker Engine', 'Node.js 20+ (npm fallback)'],
    defaultUrl: 'http://localhost:5678/mcp',
    defaultPort: '5678',
    dockerCommand:
      'docker run -d --name n8n -p 5678:5678 -v n8n_data:/home/node/.n8n docker.n8n.io/n8nio/n8n',
    npmCommand: 'npx n8n',
    detectHint:
      'Probe http://localhost:5678 and http://localhost:5678/mcp. Reuse a running n8n. Prefer MCP at `/mcp` when the instance exposes it; otherwise use the app URL + REST.',
    healthCheck: 'n8n editor loads on :5678. Then create an API key in Settings.',
    credentialHow:
      'In n8n: Settings → n8n API → Create an API key. Optional: note webhook paths for inbound events.',
    authPasteFormat: 'n8n API key (sent as X-N8N-API-KEY)',
    authHeader: 'X-N8N-API-KEY: <api_key>',
    chatCommands: ['/n8n', '/automate'],
    testInChat:
      'In STS workspace chat, run `/n8n` then list workflows (`n8n_list_workflows`). Trigger only after the creator confirms.',
    presetSync:
      'Create or update a workflow named for this STS workspace (lead ingest / social posting). If a matching workflow exists, update it. Do not delete other workflows.',
    inbound:
      'Inbound: webhooks and workflow results flow from n8n into STS chat.',
    outbound:
      'Outbound: STS chat can execute named workflows or POST `/webhook/` on the connected instance.',
  },
  chatwoot: {
    product: 'Chatwoot',
    runtimes: ['Docker Desktop or Docker Engine + Compose', 'Ruby/Node local stack (fallback)'],
    defaultUrl: 'http://localhost:3001',
    defaultPort: '3001',
    dockerCommand:
      'git clone https://github.com/chatwoot/chatwoot.git && cd chatwoot && docker compose up -d',
    npmCommand:
      'pnpm install && pnpm rails db:chatwoot_prepare && pnpm vite && pnpm rails s -p 3001',
    detectHint:
      'Probe http://localhost:3001. Reuse a running Chatwoot. After signup, note the numeric Account ID from the URL.',
    healthCheck: 'Chatwoot login/dashboard loads. Then copy Profile → Access Token.',
    credentialHow:
      'In Chatwoot: Profile → Access Token. Combine as `accountId:api_access_token` (example `1:cwt_...`).',
    authPasteFormat: 'accountId:api_access_token',
    authHeader: 'api_access_token: <token>  (REST path uses /api/v1/accounts/{account_id}/…)',
    chatCommands: ['/chatwoot', '/inbox'],
    testInChat:
      'In STS workspace chat, run `/chatwoot` then list inboxes or unread (`chatwoot_list_inboxes`, `chatwoot_list_unread`).',
    presetSync:
      'Verify WhatsApp/Email/Website inboxes. Optionally create or label an inbox for this STS workspace. Do not delete production inboxes.',
    inbound:
      'Inbound: WhatsApp, email, and web conversations arrive in STS chat from Chatwoot.',
    outbound:
      'Outbound: STS chat can send replies back through the connected Chatwoot inbox.',
  },
  firecrawl: {
    product: 'Firecrawl',
    runtimes: ['Hosted Firecrawl MCP', 'Docker (self-hosted fallback)'],
    defaultUrl: 'https://mcp.firecrawl.dev/mcp',
    defaultPort: '3002',
    dockerCommand:
      'docker run -d -p 3002:3002 -e FIRECRAWL_API_KEY=your_key mendableai/firecrawl',
    npmCommand: 'npx -y firecrawl-mcp',
    detectHint:
      'Probe the MCP URL (hosted https://mcp.firecrawl.dev/mcp or local :3002). Do not recreate a cluster if hosted MCP already works.',
    healthCheck: 'MCP initialize handshake succeeds.',
    credentialHow:
      'Use a Firecrawl API key. Hosted MCP often embeds the key in the URL; otherwise paste Bearer.',
    authPasteFormat: 'Firecrawl API key (Bearer, if the MCP URL needs it)',
    authHeader: 'Authorization: Bearer <firecrawl_api_key>',
    chatCommands: ['/firecrawl', '/crawl'],
    testInChat:
      'In STS workspace chat, run `/firecrawl` and crawl a public page from this workspace profile.',
    presetSync:
      'Crawl the creator site from STS links and summarize pages that should update the publish profile.',
    inbound: 'Inbound: crawled page text flows into STS as workspace context.',
    outbound: 'Outbound: STS asks Firecrawl to crawl URLs the creator names in chat.',
  },
  custom: {
    product: 'custom MCP server',
    runtimes: ['Docker or Node, depending on the server'],
    defaultUrl: 'http://localhost:3333',
    defaultPort: '3333',
    dockerCommand: 'docker run --rm -p 3333:3333 your-mcp-server:latest',
    npmCommand: 'npx -y @modelcontextprotocol/server-everything',
    detectHint: 'Probe the MCP URL with an initialize handshake. Reuse a running server.',
    healthCheck: 'MCP initialize returns a server name and tools.',
    credentialHow: 'If the server requires auth, copy its Bearer token. Otherwise leave secret empty.',
    authPasteFormat: 'Optional Bearer token',
    authHeader: 'Authorization: Bearer <token> (optional)',
    chatCommands: ['/mcp', '/custom'],
    testInChat: 'In STS workspace chat, run `/mcp` and list tools from the connected server.',
    presetSync:
      'Map this STS publish profile onto the custom MCP tools (upsert). Confirm before destructive calls.',
    inbound: 'Inbound: STS chat can read tools/resources from the MCP server.',
    outbound: 'Outbound: STS chat can call MCP tools that mutate the external system.',
  },
}

function recipeFor(kind: string): PartnerRecipe {
  return RECIPES[kind] || RECIPES.custom
}

function fence(lang: string, body: string) {
  return ['```' + lang, body.trim(), '```'].join('\n')
}

function workspaceBlock(ctx: PartnerCliPromptContext) {
  const base = ctx.appBaseUrl.replace(/\/$/, '')
  const tenantQs = ctx.workspaceId
    ? `?tenantId=${ctx.workspaceId}&kind=${ctx.kind}`
    : `?kind=${ctx.kind}`
  return [
    '## STS-AI workspace',
    `- Product: STS-AI (this browser app)`,
    `- Workspace name: ${ctx.workspaceName || '(unknown — ask the creator to open Partners with a workspace selected)'}`,
    `- Workspace ID: ${ctx.workspaceId || '(missing)'}`,
    `- Publish profile ID: ${ctx.publishProfileId || '(none linked yet)'}`,
    `- Connector status: ${ctx.connected ? 'ALREADY CONNECTED in STS Partners' : 'NOT CONNECTED yet'}`,
    `- Integration page: ${base}/tenants/partners${tenantQs}`,
    `- Partners catalog: ${base}/tenants`,
    `- MCP handshake: POST ${base}/api/mcp/handshake`,
    `- MCP JSON-RPC: POST ${base}/api/mcp/jsonrpc`,
    `- Workspace chat: ${base}/tenants/chat`,
  ].join('\n')
}

function urlOf(recipe: PartnerRecipe, ctx: PartnerCliPromptContext) {
  return ctx.mcpUrl || recipe.defaultUrl
}

function installSet(ctx: PartnerCliPromptContext, recipe: PartnerRecipe): IntegrationPromptSet {
  const cursor = [
    `You are given a task to install ${recipe.product} on this machine for an STS-AI workspace.`,
    '',
    'Do not connect STS yet. Do not paste API tokens. Stop when the app is healthy and print the local URL.',
    '',
    'The machine should support:',
    ...recipe.runtimes.map((item) => `- ${item}`),
    '',
    'If Docker is missing, install Docker first (or use the npm/bench fallback). Prefer Docker.',
    '',
    workspaceBlock(ctx),
    '',
    '## Hard rules',
    '1. If the app is already running, reuse it. Do not reinstall.',
    '2. Never invent secrets. You do not need an API token for this step.',
    '3. Bind localhost unless the creator asks for LAN/public.',
    '',
    '## Task',
    recipe.detectHint,
    '',
    'Docker (preferred):',
    fence('bash', recipe.dockerCommand),
    '',
    'Fallback without Docker:',
    fence('bash', recipe.npmCommand),
    '',
    `Health: ${recipe.healthCheck}`,
    '',
    '## Done when',
    `- ${recipe.product} responds on ${urlOf(recipe, ctx)} (or the port you actually used).`,
    '- You printed the exact URL for the creator.',
    '- You told them to click Walkthrough step 2 on the STS integration page (Connect → Engineered for constraints).',
    '',
    '## Implementation guidelines',
    '1. Inspect docker ps / listening ports first.',
    '2. Create compose/.env only if missing.',
    '3. Do not commit real secrets.',
    '',
    '## Questions to ask only if blocked',
    `- Is ${recipe.product} already hosted somewhere else? If yes, skip Docker and report that URL.`,
    '- Should this bind to localhost only?',
  ].join('\n')

  const claude = [
    `You are given a task to install ${recipe.product} on this machine for STS-AI.`,
    '',
    'Inspect the machine. Prefer Docker. Reuse a running instance. Do not connect STS and do not create API tokens in this step. Print the URL when healthy, then tell the creator to open Walkthrough step 2.',
    '',
    workspaceBlock(ctx),
    '',
    recipe.detectHint,
    '',
    fence('bash', recipe.dockerCommand),
    '',
    'Fallback:',
    fence('bash', recipe.npmCommand),
    '',
    `Health: ${recipe.healthCheck}`,
    `Expected URL: ${urlOf(recipe, ctx)}`,
  ].join('\n')

  const cli = [
    `# STS-AI → ${recipe.product} (install only)`,
    `# When this is healthy, click Walkthrough 2 and paste URL + API into Engineered for constraints.`,
    '',
    '# Docker (preferred)',
    recipe.dockerCommand,
    '',
    '# Fallback',
    recipe.npmCommand,
  ].join('\n')

  const universal = [
    `// --- Install ${recipe.product} ---`,
    `kind: ${ctx.kind}`,
    `url: ${urlOf(recipe, ctx)}`,
    `port: ${recipe.defaultPort}`,
    '',
    recipe.detectHint,
    '',
    recipe.dockerCommand,
    '',
    recipe.npmCommand,
    '',
    `// Health: ${recipe.healthCheck}`,
    '// Next: Walkthrough 2 — connect in Engineered for constraints.',
  ].join('\n')

  return { cursor, claude, cli, universal }
}

function connectSet(ctx: PartnerCliPromptContext, recipe: PartnerRecipe): IntegrationPromptSet {
  const url = urlOf(recipe, ctx)
  const cursor = [
    `You are given a task to connect a running ${recipe.product} instance to this STS-AI workspace.`,
    '',
    `${recipe.product} should already be installed (Walkthrough 1). If it is not reachable at ${url}, STOP and tell the creator to finish install first.`,
    '',
    'Do not reinstall Docker. This step is credentials + paste into STS.',
    '',
    workspaceBlock(ctx),
    '',
    '## Hard rules',
    '1. Never invent API secrets. Create them in the partner UI or read existing local env.',
    '2. Do not put the secret in git. The creator pastes it into STS.',
    '3. You do not call STS Connect APIs unless they ask. The browser form does that.',
    '',
    '## Task',
    `Create credentials: ${recipe.credentialHow}`,
    '',
    'Then tell the creator — stay on this STS integration page:',
    '1. Scroll down to **Engineered for constraints.**',
    `2. Paste App / MCP URL: \`${url}\``,
    `3. Paste API token / secret as: \`${recipe.authPasteFormat}\``,
    `4. Click **Connect ${recipe.product}**`,
    '',
    `- Auth on the wire: ${recipe.authHeader}`,
    '- STS stores the secret on the workspace connector and talks over webhook/API.',
    '',
    '## Done when',
    '- You printed URL + secret format (not the raw secret if avoidable).',
    '- Creator has pasted both fields into Engineered for constraints and clicked Connect.',
    '- You told them to click Walkthrough step 3 to test and apply the workspace profile.',
    '',
    '## Implementation guidelines',
    '1. Probe the running app first.',
    '2. Open the partner admin UI if a token must be created there.',
    '3. Confirm the paste format before they click Connect.',
  ].join('\n')

  const claude = [
    `You are given a task to connect running ${recipe.product} to STS-AI.`,
    '',
    `If ${url} is down, stop and send them back to Walkthrough 1. Otherwise create credentials and tell them to paste into **Engineered for constraints.**`,
    '',
    workspaceBlock(ctx),
    '',
    recipe.credentialHow,
    '',
    `URL: ${url}`,
    `Secret format: ${recipe.authPasteFormat}`,
    `Header: ${recipe.authHeader}`,
    '',
    'Creator steps on this page:',
    '1. Scroll to Engineered for constraints.',
    '2. Paste URL + secret.',
    `3. Click Connect ${recipe.product}.`,
    '4. Then open Walkthrough 3.',
  ].join('\n')

  const cli = [
    `# STS-AI → ${recipe.product} (connect)`,
    `# App should already be running at ${url}`,
    `# Scroll this page to Engineered for constraints. and paste:`,
    `#   URL:    ${url}`,
    `#   Secret: ${recipe.authPasteFormat}`,
    `# Then click Connect ${recipe.product}.`,
    '',
    `# Credential hint: ${recipe.credentialHow}`,
    `curl -sS -o /dev/null -w "%{http_code}\\n" ${url.replace(/\/mcp\/?$/, '')} || true`,
  ].join('\n')

  const universal = [
    `// --- Connect ${recipe.product} to STS-AI ---`,
    `kind: ${ctx.kind}`,
    `url: ${url}`,
    `auth_paste: ${recipe.authPasteFormat}`,
    `auth_header: ${recipe.authHeader}`,
    '',
    recipe.credentialHow,
    '',
    '// On this STS page → Engineered for constraints.',
    `Paste App / MCP URL: ${url}`,
    `Paste API token / secret: ${recipe.authPasteFormat}`,
    `Click Connect ${recipe.product}.`,
    '',
    workspaceBlock(ctx),
    '',
    '// Next: Walkthrough 3 — test + apply workspace profile.',
  ].join('\n')

  return { cursor, claude, cli, universal }
}

function testSet(ctx: PartnerCliPromptContext, recipe: PartnerRecipe): IntegrationPromptSet {
  const url = urlOf(recipe, ctx)
  const cursor = [
    `You are given a task to test the STS-AI ↔ ${recipe.product} connection and apply this workspace profile if needed.`,
    '',
    `The connector should already be connected (Walkthrough 2). If status is NOT CONNECTED, STOP and tell the creator to paste URL + ${recipe.authPasteFormat} into **Engineered for constraints.** first.`,
    '',
    workspaceBlock(ctx),
    '',
    '## Hard rules',
    '1. Prefer idempotent upserts. Confirm before deletes.',
    '2. Keep Bangla/Unicode profile text intact — do not ASCII-normalize.',
    '3. Never invent secrets. Use the connected connector.',
    '4. Confirm before outbound writes that mutate the partner app.',
    '',
    '## Task',
    recipe.testInChat,
    '',
    recipe.presetSync,
    '',
    recipe.inbound,
    recipe.outbound,
    '',
    `Chat commands: ${recipe.chatCommands.join(', ')}`,
    `Partner URL: ${url}`,
    '',
    'If handshake/profile read fails, ask the creator to stay signed in to STS, or paste compact profile JSON.',
    '',
    '## Done when',
    '- A read test from STS chat succeeds.',
    '- Profile/preset tweaks are applied only where the partner is empty or mismatched.',
    '- You report what was created/updated and any manual follow-ups.',
    '',
    '## Implementation guidelines',
    '1. Test read tools first.',
    '2. Then sync the STS publish profile into the partner.',
    '3. Finish with IDs (products, workflows, inboxes, items).',
  ].join('\n')

  const claude = [
    `You are given a task to test STS-AI ↔ ${recipe.product} and apply this workspace profile.`,
    '',
    'If the connector is not connected, stop and send them to Engineered for constraints (Walkthrough 2). Otherwise run the chat test, then upsert the STS publish profile. No destructive wipes.',
    '',
    workspaceBlock(ctx),
    '',
    recipe.testInChat,
    '',
    recipe.presetSync,
    '',
    recipe.inbound,
    recipe.outbound,
    '',
    `Commands: ${recipe.chatCommands.join(', ')}`,
  ].join('\n')

  const cli = [
    `# STS-AI → ${recipe.product} (test + profile)`,
    `# Connector must already be connected. Chat test: ${recipe.chatCommands[0]}`,
    `# Then apply this workspace publish profile if the partner needs tweaking.`,
    '',
    `curl -sS -o /dev/null -w "%{http_code}\\n" ${url.replace(/\/mcp\/?$/, '')} || true`,
    '',
    `# ${recipe.testInChat}`,
    `# ${recipe.presetSync}`,
  ].join('\n')

  const universal = [
    `// --- Test + preset ${recipe.product} ---`,
    `kind: ${ctx.kind}`,
    `url: ${url}`,
    `chat: ${recipe.chatCommands.join(' ')}`,
    `connected: ${ctx.connected ? 'yes' : 'no'}`,
    '',
    recipe.testInChat,
    '',
    recipe.presetSync,
    '',
    recipe.inbound,
    recipe.outbound,
    '',
    workspaceBlock(ctx),
  ].join('\n')

  return { cursor, claude, cli, universal }
}

export function buildIntegrationAiPrompts(ctx: PartnerCliPromptContext): IntegrationAiPrompts {
  const preset = PARTNER_PRESETS.find((item) => item.kind === ctx.kind) ?? PARTNER_PRESETS[PARTNER_PRESETS.length - 1]
  const recipe = recipeFor(preset.kind)
  const resolved: PartnerCliPromptContext = {
    ...ctx,
    kind: preset.kind,
    label: ctx.label || preset.label,
    mcpUrl: ctx.mcpUrl || recipe.defaultUrl,
  }

  return {
    install: installSet(resolved, recipe),
    connect: connectSet(resolved, recipe),
    test: testSet(resolved, recipe),
  }
}
