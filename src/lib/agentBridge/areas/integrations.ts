import 'server-only'
import { prismaClient } from '@/lib/prismaClient'
import { getCreatorBusiness } from '@/lib/business/creatorBusiness'
import { loadLeadConnectionSettings } from '@/lib/leads/leadConnectionSettings'
import { buildPartnerToolBundle, executePartnerTool, loadPartnerConnectorsWithSecrets } from '@/lib/partners/toolRegistry'
import { AgentInputError, str, type AgentContext, type AgentTool } from '../types'

/**
 * Integrations: what is connected, the tools those connections offer (n8n, OpenSEO, Medusa,
 * ERPNext, OpenSEO, custom MCP servers…), and changes to them. Reading is instant; adding a
 * connection or running a tool that changes something waits for the creator's approval.
 */

const PARTNER_KINDS = ['n8n', 'openseo', 'medusa', 'erpnext', 'custom'] as const
const AUTH_TYPES = ['none', 'bearer', 'token', 'api_key', 'basic'] as const
const WORKFLOW_MAX_BYTES = 2_000_000
/** Where workflow JSON may be downloaded from (the server fetches it, so no free-form hosts). */
const WORKFLOW_HOSTS = new Set(['raw.githubusercontent.com', 'gist.githubusercontent.com', 'github.com', 'n8n.io', 'api.n8n.io'])

async function workspaceIdOf(ctx: AgentContext): Promise<string> {
  const business = await getCreatorBusiness(ctx.userId)
  if (!business) throw new Error('This account has no business set up yet.')
  return business.workspaceId
}

async function bundleFor(ctx: AgentContext) {
  const workspaceId = await workspaceIdOf(ctx)
  const connectors = await loadPartnerConnectorsWithSecrets(workspaceId, ctx.userId)
  const serviceIds = connectors.map((c) => (c.kind === 'custom' ? `custom:${c.id}` : c.kind))
  return buildPartnerToolBundle(workspaceId, ctx.userId, serviceIds)
}

function argsOf(input: Record<string, unknown>): Record<string, unknown> {
  const args = input.arguments
  if (args === undefined || args === null) return {}
  if (typeof args !== 'object' || Array.isArray(args)) throw new AgentInputError('"arguments" must be an object.')
  return args as Record<string, unknown>
}

/** Fetches an n8n workflow export and keeps only what n8n's API accepts on create. */
async function fetchWorkflow(url: string) {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new AgentInputError('workflow_url is not a URL.')
  }
  if (parsed.protocol !== 'https:') throw new AgentInputError('workflow_url must use https.')
  if (!WORKFLOW_HOSTS.has(parsed.hostname)) {
    throw new AgentInputError(`workflow_url must be on ${[...WORKFLOW_HOSTS].join(', ')}.`)
  }
  // github.com/<owner>/<repo>/blob/<ref>/<path> → the raw file.
  if (parsed.hostname === 'github.com') {
    const match = parsed.pathname.match(/^\/([^/]+)\/([^/]+)\/blob\/(.+)$/)
    if (!match) throw new AgentInputError('Use a link to a workflow file (…/blob/…/file.json).')
    parsed = new URL(`https://raw.githubusercontent.com/${match[1]}/${match[2]}/${match[3]}`)
  }
  const res = await fetch(parsed, { signal: AbortSignal.timeout(20_000), redirect: 'error' })
  if (!res.ok) throw new AgentInputError(`Could not download the workflow (HTTP ${res.status}).`)
  const text = await res.text()
  if (text.length > WORKFLOW_MAX_BYTES) throw new AgentInputError('That workflow file is too large.')
  let json: Record<string, unknown>
  try {
    json = JSON.parse(text)
  } catch {
    throw new AgentInputError('workflow_url is not n8n workflow JSON.')
  }
  if (!Array.isArray(json.nodes) || typeof json.connections !== 'object') {
    throw new AgentInputError('workflow_url is not n8n workflow JSON (no nodes or connections).')
  }
  return {
    name: typeof json.name === 'string' && json.name.trim() ? json.name.trim().slice(0, 120) : 'Imported workflow',
    nodes: json.nodes as unknown[],
    connections: json.connections,
    settings: json.settings && typeof json.settings === 'object' ? json.settings : {},
  }
}

export const INTEGRATION_TOOLS: AgentTool[] = [
  {
    kind: 'read',
    name: 'list_connections',
    area: 'integrations',
    title: 'Connections',
    description:
      'What the creator has connected in sts-ai → Integrations: partner tools (n8n, OpenSEO, Medusa, ERPNext, custom MCP…), Telegram, phone line, WhatsApp, Instagram, email, Fathom, Google Calendar and Serper. No secrets.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    async run(ctx) {
      const workspaceId = await workspaceIdOf(ctx)
      const [partners, telegram, phone, whatsapp, instagram, email, lead] = await Promise.all([
        prismaClient.workspacePartnerConnector.findMany({
          where: { workspaceId, userId: ctx.userId },
          select: { id: true, kind: true, label: true, enabled: true, mcpUrl: true },
        }),
        prismaClient.telegramConnection.findFirst({ where: { workspaceId, userId: ctx.userId }, select: { botUsername: true, chatId: true } }),
        prismaClient.phoneLine.findFirst({ where: { workspaceId, userId: ctx.userId }, select: { phoneNumber: true } }),
        prismaClient.whatsAppConnection.findUnique({ where: { userId: ctx.userId }, select: { displayPhone: true } }),
        prismaClient.instagramConnection.findUnique({ where: { userId: ctx.userId }, select: { username: true } }),
        prismaClient.emailConnection.findUnique({ where: { userId: ctx.userId }, select: { fromEmail: true } }),
        loadLeadConnectionSettings(ctx.userId),
      ])
      const connections = {
        partners: partners.map((p) => ({ id: p.id, kind: p.kind, label: p.label, enabled: p.enabled, url: p.mcpUrl })),
        telegram: telegram ? { bot: `@${telegram.botUsername}`, alertsLinked: Boolean(telegram.chatId) } : null,
        phoneLine: phone?.phoneNumber ?? null,
        whatsapp: whatsapp ? whatsapp.displayPhone || 'connected' : null,
        instagram: instagram ? `@${instagram.username ?? 'connected'}` : null,
        email: email?.fromEmail ?? null,
        fathom: lead.fathomOk,
        googleCalendar: lead.gcalOk,
        serper: lead.serperConfigured,
        setupPage: '/integrations',
      }
      return { text: JSON.stringify(connections, null, 2), structured: connections }
    },
  },
  {
    kind: 'read',
    name: 'list_connection_tools',
    area: 'integrations',
    title: 'Tools of the connections',
    description:
      'The tools the creator’s partner connections offer (for example n8n_list_workflows, n8n_execute_workflow, OpenSEO keyword research), each marked read or write. Call read tools with read_from_connection and write tools with act_on_connection.',
    inputSchema: {
      type: 'object',
      properties: { kind: { type: 'string', description: 'Only this connection kind, e.g. n8n.' } },
      additionalProperties: false,
    },
    async run(ctx, input) {
      const kind = str(input, 'kind', { max: 40 }).toLowerCase()
      const bundle = await bundleFor(ctx)
      const tools = bundle.tools
        .filter((t) => !kind || t.connectorKind === kind)
        .map((t) => ({ name: t.name, sideEffect: t.sideEffect, connection: t.connectorLabel, description: t.description, parameters: t.parameters }))
      const statuses = bundle.statuses.map((s) => ({ connection: s.label, kind: s.kind, status: s.status, message: s.message }))
      if (tools.length === 0) return { text: `No tools available. Connection status: ${JSON.stringify(statuses)}`, structured: { tools, statuses } }
      return { text: JSON.stringify({ tools, statuses }, null, 2), structured: { tools, statuses } }
    },
  },
  {
    kind: 'read',
    name: 'read_from_connection',
    area: 'integrations',
    title: 'Use a connection (read)',
    description: 'Run a read-only tool of a connection (sideEffect "read" in list_connection_tools), e.g. list n8n workflows or executions.',
    inputSchema: {
      type: 'object',
      properties: {
        tool: { type: 'string', description: 'Tool name from list_connection_tools.' },
        arguments: { type: 'object', description: 'The tool’s arguments.' },
      },
      required: ['tool'],
      additionalProperties: false,
    },
    async run(ctx, input) {
      const name = str(input, 'tool', { max: 120, required: true })
      const bundle = await bundleFor(ctx)
      const definition = bundle.tools.find((t) => t.name === name)
      if (!definition) throw new AgentInputError(`Unknown tool ${name}. Call list_connection_tools.`)
      if (definition.sideEffect === 'write') throw new AgentInputError(`${name} changes something: use act_on_connection.`)
      const result = await executePartnerTool({ bundle, name, args: argsOf(input) })
      if (!result.ok) throw new Error(result.error || 'The tool failed.')
      return JSON.stringify(result.data ?? null, null, 2).slice(0, 60_000)
    },
  },
  {
    kind: 'write',
    name: 'act_on_connection',
    area: 'integrations',
    title: 'Use a connection (change)',
    description:
      'Run a tool of a connection that changes something (sideEffect "write"), e.g. execute an n8n workflow or trigger a webhook. The creator approves it in sts-ai first.',
    inputSchema: {
      type: 'object',
      properties: {
        tool: { type: 'string', description: 'Tool name from list_connection_tools.' },
        arguments: { type: 'object', description: 'The tool’s arguments.' },
      },
      required: ['tool'],
      additionalProperties: false,
    },
    async propose(ctx, input) {
      const name = str(input, 'tool', { max: 120, required: true })
      const args = argsOf(input)
      const bundle = await bundleFor(ctx)
      const definition = bundle.tools.find((t) => t.name === name)
      if (!definition) throw new AgentInputError(`Unknown tool ${name}. Call list_connection_tools.`)
      return {
        title: `Run on ${definition.connectorLabel}`,
        detail: name,
        display: { connection: definition.connectorLabel, tool: name, arguments: args },
        payload: { tool: name, args },
      }
    },
    async apply(ctx, payload) {
      const bundle = await bundleFor(ctx)
      const result = await executePartnerTool({ bundle, name: String(payload.tool), args: (payload.args as Record<string, unknown>) ?? {} })
      if (!result.ok) throw new Error(result.error || 'The tool failed.')
      return result.data ?? { ok: true }
    },
  },
  {
    kind: 'write',
    name: 'propose_connection',
    area: 'integrations',
    title: 'Add or update a connection',
    description:
      'Connect a partner tool for the creator: n8n (url = the n8n base URL, auth_type api_key is sent as X-N8N-API-KEY by the n8n adapter), OpenSEO, Medusa, ERPNext, or any MCP server (kind custom). Put the key in secret: it is stored encrypted until approved and never shown. Replaces an existing connection of the same kind (except custom).',
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: [...PARTNER_KINDS] },
        label: { type: 'string', description: 'Name shown in Integrations.' },
        url: { type: 'string', description: 'MCP or base URL, https. A tool on the creator’s computer needs a tunnel (Cloudflare Tunnel or ngrok).' },
        auth_type: { type: 'string', enum: [...AUTH_TYPES], description: 'Default none.' },
        secret: { type: 'string', description: 'API key or token. Never echo it back.' },
      },
      required: ['kind', 'url'],
      additionalProperties: false,
    },
    async propose(ctx, input) {
      const kind = str(input, 'kind', { max: 20, required: true }).toLowerCase()
      if (!(PARTNER_KINDS as readonly string[]).includes(kind)) throw new AgentInputError(`kind must be one of ${PARTNER_KINDS.join(', ')}.`)
      const url = str(input, 'url', { max: 500, required: true })
      let parsed: URL
      try {
        parsed = new URL(url)
      } catch {
        throw new AgentInputError('url is not a URL.')
      }
      if (parsed.protocol !== 'https:') throw new AgentInputError('url must use https. For a tool on the creator’s computer, expose it with a tunnel first.')
      const authType = (str(input, 'auth_type', { max: 20 }) || 'none').toLowerCase()
      if (!(AUTH_TYPES as readonly string[]).includes(authType)) throw new AgentInputError(`auth_type must be one of ${AUTH_TYPES.join(', ')}.`)
      const secret = str(input, 'secret', { max: 2000 })
      const label = str(input, 'label', { max: 80 }) || kind
      await workspaceIdOf(ctx)
      return {
        title: 'Connect',
        detail: `${label} · ${parsed.host}`,
        display: { kind, label, url, authType, secret: secret ? '•••••• (hidden)' : 'none' },
        payload: { kind, label, url, authType },
        secrets: secret ? { secret } : undefined,
      }
    },
    async apply(ctx, payload, secrets) {
      const workspaceId = await workspaceIdOf(ctx)
      const kind = String(payload.kind)
      const data = {
        label: String(payload.label),
        mcpUrl: String(payload.url),
        authType: String(payload.authType),
        authSecret: secrets.secret || null,
        enabled: true,
      }
      const existing =
        kind === 'custom'
          ? null
          : await prismaClient.workspacePartnerConnector.findFirst({ where: { workspaceId, userId: ctx.userId, kind }, select: { id: true } })
      if (existing) {
        await prismaClient.workspacePartnerConnector.update({ where: { id: existing.id }, data })
        return { updated: data.label }
      }
      const created = await prismaClient.workspacePartnerConnector.create({
        data: { workspaceId, userId: ctx.userId, kind, ...data },
        select: { id: true },
      })
      return { connected: data.label, connectorId: created.id }
    },
  },
  {
    kind: 'write',
    name: 'import_n8n_workflow',
    area: 'integrations',
    title: 'Import an n8n workflow',
    description:
      'Import an n8n workflow JSON (e.g. a Social → Workflows card’s workflowUrl, or any https link to an exported workflow) into the creator’s n8n, switched off. Needs an n8n connection with an API key. The creator approves it first; credentials are added in n8n afterwards.',
    inputSchema: {
      type: 'object',
      properties: {
        workflow_url: { type: 'string', description: 'https link to the workflow JSON.' },
        name: { type: 'string', description: 'Optional new name.' },
      },
      required: ['workflow_url'],
      additionalProperties: false,
    },
    async propose(ctx, input) {
      const url = str(input, 'workflow_url', { max: 1000, required: true })
      const workflow = await fetchWorkflow(url)
      const name = str(input, 'name', { max: 120 }) || workflow.name
      const workspaceId = await workspaceIdOf(ctx)
      const n8n = (await loadPartnerConnectorsWithSecrets(workspaceId, ctx.userId)).find((c) => c.kind === 'n8n')
      if (!n8n) throw new AgentInputError('No n8n connection. Add one with propose_connection (kind n8n) first.')
      return {
        title: 'Import to n8n',
        detail: name,
        display: { name, nodes: workflow.nodes.length, from: url, into: n8n.label, active: false },
        payload: { url, name },
      }
    },
    async apply(ctx, payload) {
      const workflow = await fetchWorkflow(String(payload.url))
      const workspaceId = await workspaceIdOf(ctx)
      const n8n = (await loadPartnerConnectorsWithSecrets(workspaceId, ctx.userId)).find((c) => c.kind === 'n8n')
      if (!n8n) throw new Error('The n8n connection is gone.')
      const base = n8n.mcpUrl.replace(/\/(mcp|sse)\/?$/, '').replace(/\/$/, '')
      const res = await fetch(`${base}/api/v1/workflows`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(n8n.authSecret ? { 'X-N8N-API-KEY': n8n.authSecret } : {}),
        },
        body: JSON.stringify({ ...workflow, name: String(payload.name) }),
        signal: AbortSignal.timeout(30_000),
      })
      const text = await res.text()
      if (!res.ok) throw new Error(`n8n answered ${res.status}: ${text.slice(0, 300)}`)
      let created: { id?: string } = {}
      try {
        created = JSON.parse(text)
      } catch {
        // n8n answered 2xx without JSON; the import still happened.
      }
      return { imported: payload.name, workflowId: created.id ?? null, open: created.id ? `${base}/workflow/${created.id}` : base, active: false }
    },
  },
]
