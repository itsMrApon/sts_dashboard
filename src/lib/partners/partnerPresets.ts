export type PartnerPreset = {
  kind: string
  label: string
  description: string
  defaultUrl: string
  chipClassName: string
}

export const PARTNER_PRESETS: PartnerPreset[] = [
  {
    kind: 'medusa',
    label: 'Medusa.js',
    description: 'Commerce catalog, orders, and sales (Docker REST/MCP)',
    defaultUrl: 'http://localhost:9001',
    chipClassName: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/40',
  },
  {
    kind: 'erpnext',
    label: 'ERPNext',
    description: 'ERP documents, inventory, and POS (Docker REST)',
    defaultUrl: 'http://localhost:8080',
    chipClassName: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40',
  },
  {
    kind: 'n8n',
    label: 'n8n',
    description: 'Workflow automation via MCP/SSE or webhooks',
    defaultUrl: 'http://localhost:5678/mcp',
    chipClassName: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40',
  },
  {
    kind: 'chatwoot',
    label: 'Chatwoot',
    description: 'Omnichannel inbox (WhatsApp, email, web, social) via REST',
    defaultUrl: 'http://localhost:3001',
    chipClassName: 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/40',
  },
  {
    kind: 'firecrawl',
    label: 'Firecrawl',
    description: 'Crawl and extract site content',
    defaultUrl: 'https://mcp.firecrawl.dev/mcp',
    chipClassName: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/40',
  },
  {
    kind: 'custom',
    label: 'Custom MCP',
    description: 'Any MCP server URL (stdio bridge or HTTP)',
    defaultUrl: 'https://',
    chipClassName: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40',
  },
]
