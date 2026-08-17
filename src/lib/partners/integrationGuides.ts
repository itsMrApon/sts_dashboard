import { PARTNER_PRESETS } from '@/lib/partners/partnerPresets'

export type IntegrationCliOption = {
  id: 'docker' | 'npm'
  label: string
  command: string
}

export type PartnerWalkthrough = {
  install: string
  connect: string
  test: string
}

export type PartnerIntegrationGuide = {
  kind: string
  label: string
  tagline: string
  zeroConfigTitle: string
  zeroConfigBody: string
  constraintsTitle: string
  constraintsBody: string
  authHint: string
  defaultUrl: string
  walkthrough: PartnerWalkthrough
  cliOptions: IntegrationCliOption[]
}

const GUIDES: Record<string, Omit<PartnerIntegrationGuide, 'kind' | 'label' | 'defaultUrl'>> = {
  medusa: {
    tagline: 'Commerce catalog, orders, and sales for this workspace.',
    zeroConfigTitle: 'Zero-config previews',
    zeroConfigBody:
      'Click a walkthrough step, then copy Cursor, Claude, CLI, or Universal. Step 1 installs Medusa. Step 2 pastes URL + token into Engineered for constraints. Step 3 tests chat and applies this workspace profile.',
    constraintsTitle: 'Engineered for constraints',
    constraintsBody:
      'STS talks to Medusa over Admin/MCP on the URL you paste. No extra adapter. Token goes in as Bearer auth; chat uses /medusa or /ecommerce.',
    authHint: 'Medusa Admin API token',
    walkthrough: {
      install:
        'Install Medusa on this machine with Docker (preferred) or npx create-medusa-app. Copy a prompt from the preview — do not follow a wiki.',
      connect:
        'Scroll to Engineered for constraints. Paste the Admin URL (usually http://localhost:9001) and the Medusa Admin API token, then Connect.',
      test: 'Open workspace chat, run /medusa, and confirm products or orders. If the catalog is empty, apply this workspace publish profile to Medusa.',
    },
    cliOptions: [
      {
        id: 'npm',
        label: 'npm',
        command: 'npx create-medusa-app@latest',
      },
      {
        id: 'docker',
        label: 'Docker',
        command:
          'docker compose up -d postgres redis && npx create-medusa-app@latest --skip-db --db-url postgres://postgres:postgres@localhost:5432/medusa',
      },
    ],
  },
  erpnext: {
    tagline: 'ERP documents, inventory, POS, and accounting.',
    zeroConfigTitle: 'Zero-config previews',
    zeroConfigBody:
      'Click a walkthrough step, then copy Cursor, Claude, CLI, or Universal. Step 1 stands up ERPNext. Step 2 pastes site URL + key:secret into Engineered for constraints. Step 3 tests chat and syncs this workspace profile.',
    constraintsTitle: 'Engineered for constraints',
    constraintsBody:
      'Paste the ERPNext site URL and key:secret. STS uses REST for documents and POS. Chat uses /erpnext or /erp.',
    authHint: 'API key:secret',
    walkthrough: {
      install:
        'Install ERPNext on this machine with Docker (frappe_docker) or bench. Copy a prompt from the preview — skip the Frappe tutorial.',
      connect:
        'Scroll to Engineered for constraints. Paste the site URL (usually http://localhost:8080) and API key:secret, then Connect.',
      test: 'Open workspace chat, run /erpnext, and find an item or open invoice. If Company/Items are empty, sync this workspace profile into ERPNext.',
    },
    cliOptions: [
      {
        id: 'docker',
        label: 'Docker',
        command:
          'git clone https://github.com/frappe/frappe_docker && cd frappe_docker && cp example.env .env && docker compose -f pwd.yml up -d',
      },
      {
        id: 'npm',
        label: 'Bench',
        command: 'bench init frappe-bench && cd frappe-bench && bench get-app erpnext && bench new-site erp.localhost --install-app erpnext',
      },
    ],
  },
  n8n: {
    tagline: 'Workflows, webhooks, and automation for this workspace.',
    zeroConfigTitle: 'Zero-config previews',
    zeroConfigBody:
      'Click a walkthrough step, then copy Cursor, Claude, CLI, or Universal. Step 1 runs n8n. Step 2 pastes MCP URL + API key into Engineered for constraints. Step 3 tests workflows and applies this workspace profile.',
    constraintsTitle: 'Engineered for constraints',
    constraintsBody:
      'Point STS at n8n MCP (`/mcp`) or the app URL. API key is sent as X-N8N-API-KEY. Chat uses /n8n or /automate.',
    authHint: 'n8n API key',
    walkthrough: {
      install:
        'Install n8n on this machine with Docker (preferred) or npx n8n. Copy a prompt from the preview — no install checklist.',
      connect:
        'Scroll to Engineered for constraints. Paste http://localhost:5678/mcp (or the app URL) and the n8n API key, then Connect.',
      test: 'Open workspace chat, run /n8n, and list workflows. If none match this workspace, apply the STS profile / starter workflow.',
    },
    cliOptions: [
      {
        id: 'docker',
        label: 'Docker',
        command:
          'docker run -d --name n8n -p 5678:5678 -v n8n_data:/home/node/.n8n docker.n8n.io/n8nio/n8n',
      },
      {
        id: 'npm',
        label: 'npm',
        command: 'npx n8n',
      },
    ],
  },
  chatwoot: {
    tagline: 'WhatsApp, email, web chat, and social inbox.',
    zeroConfigTitle: 'Zero-config previews',
    zeroConfigBody:
      'Click a walkthrough step, then copy Cursor, Claude, CLI, or Universal. Step 1 boots Chatwoot. Step 2 pastes URL + accountId:token into Engineered for constraints. Step 3 tests the inbox and labels this workspace.',
    constraintsTitle: 'Engineered for constraints',
    constraintsBody:
      'App URL plus auth as accountId:api_access_token. STS uses Chatwoot REST. Chat uses /chatwoot or /inbox.',
    authHint: 'accountId:api_access_token',
    walkthrough: {
      install:
        'Install Chatwoot on this machine with the official Docker Compose stack. Copy a prompt from the preview — skip the multi-page install.',
      connect:
        'Scroll to Engineered for constraints. Paste http://localhost:3001 and accountId:api_access_token, then Connect.',
      test: 'Open workspace chat, run /chatwoot, and list inboxes or unread. Label or create an inbox for this workspace if needed.',
    },
    cliOptions: [
      {
        id: 'docker',
        label: 'Docker',
        command:
          'git clone https://github.com/chatwoot/chatwoot.git && cd chatwoot && docker compose up -d',
      },
      {
        id: 'npm',
        label: 'npm',
        command: 'pnpm install && pnpm rails db:chatwoot_prepare && pnpm vite && pnpm rails s -p 3001',
      },
    ],
  },
  firecrawl: {
    tagline: 'Crawl and extract site content into this workspace.',
    zeroConfigTitle: 'Zero-config previews',
    zeroConfigBody:
      'Click a walkthrough step, then copy Cursor, Claude, CLI, or Universal. Step 1 wires Firecrawl MCP. Step 2 pastes the MCP URL into Engineered for constraints. Step 3 crawls a page from this workspace profile.',
    constraintsTitle: 'Engineered for constraints',
    constraintsBody:
      'Paste the Firecrawl MCP URL. Hosted works as https://mcp.firecrawl.dev/mcp with your key. Chat uses /firecrawl or /crawl.',
    authHint: 'Firecrawl API key (if the MCP URL needs Bearer)',
    walkthrough: {
      install:
        'Use hosted Firecrawl MCP, or run the Docker image locally. Copy a prompt from the preview.',
      connect:
        'Scroll to Engineered for constraints. Paste the MCP URL and API key if required, then Connect.',
      test: 'Open workspace chat, run /firecrawl, and crawl a page from this workspace profile.',
    },
    cliOptions: [
      {
        id: 'docker',
        label: 'Docker',
        command: 'docker run -d -p 3002:3002 -e FIRECRAWL_API_KEY=your_key mendableai/firecrawl',
      },
      {
        id: 'npm',
        label: 'npm',
        command: 'npx -y firecrawl-mcp',
      },
    ],
  },
  custom: {
    tagline: 'Any MCP server this workspace should chat with.',
    zeroConfigTitle: 'Zero-config previews',
    zeroConfigBody:
      'Click a walkthrough step, then copy Cursor, Claude, CLI, or Universal. Step 1 runs the MCP. Step 2 pastes the URL into Engineered for constraints. Step 3 tests tools and maps this workspace profile.',
    constraintsTitle: 'Engineered for constraints',
    constraintsBody:
      'Paste the MCP URL. Optional Bearer secret. Chat uses /mcp or /custom.',
    authHint: 'Optional Bearer token',
    walkthrough: {
      install:
        'Run or dockerize the MCP server on this machine. Copy a prompt from the preview.',
      connect:
        'Scroll to Engineered for constraints. Paste the MCP URL and optional Bearer token, then Connect.',
      test: 'Open workspace chat, run /mcp, and list tools. Map this workspace profile onto the server if needed.',
    },
    cliOptions: [
      {
        id: 'npm',
        label: 'npm',
        command: 'npx -y @modelcontextprotocol/server-everything',
      },
      {
        id: 'docker',
        label: 'Docker',
        command: 'docker run --rm -p 3333:3333 your-mcp-server:latest',
      },
    ],
  },
}

export function getPartnerIntegrationGuide(kind: string): PartnerIntegrationGuide {
  const preset = PARTNER_PRESETS.find((item) => item.kind === kind) ?? PARTNER_PRESETS[PARTNER_PRESETS.length - 1]
  const guide = GUIDES[preset.kind] ?? GUIDES.custom
  return {
    kind: preset.kind,
    label: preset.label,
    defaultUrl: preset.defaultUrl,
    ...guide,
  }
}
