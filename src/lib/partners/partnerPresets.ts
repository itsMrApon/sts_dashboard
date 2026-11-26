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
    kind: 'openseo',
    label: 'OpenSEO',
    description: 'Keywords, rankings, local SEO and site audits from your OpenSEO (MCP)',
    defaultUrl: 'http://localhost:3001/mcp',
    chipClassName: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/40',
  },
  {
    kind: 'custom',
    label: 'Custom MCP',
    description: 'Any MCP server URL (stdio bridge or HTTP)',
    defaultUrl: 'https://',
    chipClassName: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40',
  },
]
