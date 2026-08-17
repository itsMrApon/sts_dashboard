import {
  CUSTOM_CONNECTOR_PREFIX,
  normalizePartnerKind,
} from '@/lib/tenants/tenantServices'

export type PartnerSlashCommand = {
  id: string
  label: string
  description: string
  prefix: string
  serviceKind: string
  showInBar?: boolean
}

export const PARTNER_SLASH_COMMANDS: PartnerSlashCommand[] = [
  {
    id: 'medusa',
    label: 'Medusa',
    description: 'Commerce catalog, orders, and sales',
    prefix: '/medusa',
    serviceKind: 'medusa',
    showInBar: true,
  },
  {
    id: 'ecommerce',
    label: 'Ecommerce',
    description: 'Same as Medusa commerce tools',
    prefix: '/ecommerce',
    serviceKind: 'medusa',
    showInBar: true,
  },
  {
    id: 'madusa',
    label: 'Medusa',
    description: 'Alias for /medusa ecommerce tools',
    prefix: '/madusa',
    serviceKind: 'medusa',
  },
  {
    id: 'ecom',
    label: 'Ecommerce',
    description: 'Alias for /medusa',
    prefix: '/ecom',
    serviceKind: 'medusa',
  },
  {
    id: 'n8n',
    label: 'n8n',
    description: 'Workflow automation and triggers',
    prefix: '/n8n',
    serviceKind: 'n8n',
    showInBar: true,
  },
  {
    id: 'automate',
    label: 'Automate',
    description: 'Same as n8n workflows',
    prefix: '/automate',
    serviceKind: 'n8n',
    showInBar: true,
  },
  {
    id: 'workflow',
    label: 'Automate',
    description: 'Alias for /n8n',
    prefix: '/workflow',
    serviceKind: 'n8n',
  },
  {
    id: 'erpnext',
    label: 'ERPNext',
    description: 'ERP documents, inventory, and POS',
    prefix: '/erpnext',
    serviceKind: 'erpnext',
    showInBar: true,
  },
  {
    id: 'erp',
    label: 'ERPNext',
    description: 'Alias for /erpnext',
    prefix: '/erp',
    serviceKind: 'erpnext',
  },
  {
    id: 'chatwoot',
    label: 'Chatwoot',
    description: 'Omnichannel inbox and replies',
    prefix: '/chatwoot',
    serviceKind: 'chatwoot',
    showInBar: true,
  },
  {
    id: 'inbox',
    label: 'Chatwoot',
    description: 'Alias for /chatwoot',
    prefix: '/inbox',
    serviceKind: 'chatwoot',
  },
  {
    id: 'firecrawl',
    label: 'Firecrawl',
    description: 'Crawl and extract site content',
    prefix: '/firecrawl',
    serviceKind: 'firecrawl',
    showInBar: true,
  },
  {
    id: 'crawl',
    label: 'Firecrawl',
    description: 'Alias for /firecrawl',
    prefix: '/crawl',
    serviceKind: 'firecrawl',
  },
  {
    id: 'mcp',
    label: 'MCP',
    description: 'Custom MCP server tools',
    prefix: '/mcp',
    serviceKind: 'custom',
    showInBar: true,
  },
  {
    id: 'custom',
    label: 'Custom MCP',
    description: 'Alias for /mcp',
    prefix: '/custom',
    serviceKind: 'custom',
  },
]

const COMMAND_BY_PREFIX = new Map(
  PARTNER_SLASH_COMMANDS.map((command) => [command.prefix, command]),
)

export function currentSlashToken(value: string): string | null {
  const match = value.match(/(?:^|\s)(\/[a-z0-9-]*)$/i)
  return match ? match[1].toLowerCase() : null
}

export function parsePartnerSlashInput(value: string): {
  prefixes: string[]
  message: string
} {
  const prefixes: string[] = []
  let rest = value.trimStart()
  while (true) {
    const match = rest.match(/^(\/[a-z0-9-]+)\s*/i)
    if (!match) break
    prefixes.push(match[1].toLowerCase())
    rest = rest.slice(match[0].length)
  }
  return { prefixes, message: rest.trim() }
}

const KNOWN_PREFIX_PATTERN = new RegExp(
  `(?:^|\\s)(${PARTNER_SLASH_COMMANDS.map((command) => command.prefix.replace('/', '\\/')).join('|')})\\b`,
  'gi',
)

const ACTIVE_PARTNER_PATTERN =
  /active partner:\s*(n8n|medusa|madusa|erpnext|chatwoot|firecrawl|custom|ecommerce|automate)/i

/**
 * Find partner slash commands anywhere in typed input or a pasted pipeline prompt.
 * Keep the original text for the LLM — do not strip `/n8n` before send.
 */
export function extractPartnerPrefixes(value: string): string[] {
  const found: string[] = []
  const seen = new Set<string>()

  const add = (prefix: string) => {
    const normalized = prefix.toLowerCase()
    if (!COMMAND_BY_PREFIX.has(normalized) || seen.has(normalized)) return
    seen.add(normalized)
    found.push(normalized)
  }

  const leading = parsePartnerSlashInput(value)
  for (const prefix of leading.prefixes) add(prefix)

  KNOWN_PREFIX_PATTERN.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = KNOWN_PREFIX_PATTERN.exec(value)) !== null) {
    add(match[1])
  }

  const active = value.match(ACTIVE_PARTNER_PATTERN)
  if (active?.[1]) {
    const kind = normalizePartnerKind(active[1])
    const command = PARTNER_SLASH_COMMANDS.find((item) => item.serviceKind === kind)
    if (command) add(command.prefix)
  }

  return found
}

export function replaceCurrentSlashToken(value: string, prefix: string): string {
  if (currentSlashToken(value)) {
    return value.replace(/(\/[a-z0-9-]*)$/i, `${prefix} `)
  }
  const trimmed = value.trim()
  return trimmed ? `${prefix} ${trimmed} ` : `${prefix} `
}

export function filterSlashCommands(token: string): PartnerSlashCommand[] {
  const normalized = token.toLowerCase()
  if (normalized === '/') return PARTNER_SLASH_COMMANDS
  return PARTNER_SLASH_COMMANDS.filter(
    (command) =>
      command.prefix.startsWith(normalized) ||
      command.label.toLowerCase().startsWith(normalized.slice(1)),
  )
}

function partnerServiceId(kind: string, id: string): string {
  const normalized = normalizePartnerKind(kind)
  return normalized === 'custom' ? `${CUSTOM_CONNECTOR_PREFIX}${id}` : normalized
}

export function resolvePartnerServices(options: {
  prefixes: string[]
  connectedPartners: Array<{ id: string; kind: string }>
}): string[] {
  const kinds = new Set<string>()
  for (const prefix of options.prefixes) {
    const command = COMMAND_BY_PREFIX.get(prefix)
    if (command) kinds.add(command.serviceKind)
  }

  const services: string[] = []
  const seen = new Set<string>()

  for (const kind of kinds) {
    const matches = options.connectedPartners.filter(
      (partner) => normalizePartnerKind(partner.kind) === kind,
    )
    if (matches.length === 0) {
      if (!seen.has(kind)) {
        seen.add(kind)
        services.push(kind)
      }
      continue
    }
    // One connector per partner kind per account — use the first enabled row.
    const partner = matches[0]
    const id = partnerServiceId(partner.kind, partner.id)
    if (seen.has(id)) continue
    seen.add(id)
    services.push(id)
  }

  return services
}
