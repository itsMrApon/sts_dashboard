import type { PartnerConnectorRuntime, PartnerToolDefinition, PartnerToolResult } from '../types'

type ChatwootAuth = {
  accountId: string
  token: string
}

type InboxRow = {
  id?: number
  name?: string
  channel_type?: string
  medium?: string
  phone_number?: string | null
}

type ConversationRow = {
  id?: number
  inbox_id?: number
  status?: string
  unread_count?: number
  last_activity_at?: number
  meta?: {
    sender?: { id?: number; name?: string; email?: string | null; phone_number?: string | null }
    channel?: string
  }
  messages?: unknown[]
  last_non_activity_message?: { content?: string | null; created_at?: number } | null
}

function baseUrl(connector: PartnerConnectorRuntime): string {
  return connector.mcpUrl
    .replace(/\/mcp\/?$/, '')
    .replace(/\/api\/v1\/?$/, '')
    .replace(/\/$/, '')
}

function resolveAuth(connector: PartnerConnectorRuntime): ChatwootAuth {
  const secret = connector.authSecret?.trim() || process.env.CHATWOOT_API_ACCESS_TOKEN?.trim() || ''
  const envAccount = process.env.CHATWOOT_ACCOUNT_ID?.trim() || ''

  if (!secret) {
    throw new Error(
      'Chatwoot auth missing. Paste accountId:api_access_token into Partners (Profile → Access Token).',
    )
  }

  // Preferred: "accountId:api_access_token"
  const colon = secret.indexOf(':')
  if (colon > 0) {
    const accountId = secret.slice(0, colon).trim()
    const token = secret.slice(colon + 1).trim()
    if (/^\d+$/.test(accountId) && token) {
      return { accountId, token }
    }
  }

  if (envAccount && secret) {
    return { accountId: envAccount, token: secret }
  }

  throw new Error(
    'Chatwoot auth must be "accountId:api_access_token" (e.g. 1:xyz…). Or set CHATWOOT_ACCOUNT_ID + token.',
  )
}

async function chatwootFetch(
  connector: PartnerConnectorRuntime,
  path: string,
  init?: RequestInit,
): Promise<unknown> {
  const auth = resolveAuth(connector)
  const url = `${baseUrl(connector)}${path.startsWith('/') ? path : `/${path}`}`
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      api_access_token: auth.token,
      ...(init?.headers as Record<string, string> | undefined),
    },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Chatwoot HTTP ${res.status}: ${text.slice(0, 240) || res.statusText}`)
  }
  if (res.status === 204) return { ok: true }
  return res.json()
}

function accountPath(connector: PartnerConnectorRuntime, suffix: string): string {
  const { accountId } = resolveAuth(connector)
  const clean = suffix.replace(/^\//, '')
  return `/api/v1/accounts/${accountId}/${clean}`
}

function normalizeChannelHint(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s_-]+/g, '')
}

/** Map friendly names → Chatwoot channel_type / meta.channel fragments. */
function channelMatchers(hint: string): string[] {
  const key = normalizeChannelHint(hint)
  const map: Record<string, string[]> = {
    whatsapp: ['whatsapp', 'channel::whatsapp'],
    email: ['email', 'channel::email'],
    telegram: ['telegram', 'channel::telegram'],
    sms: ['sms', 'twilio', 'channel::sms'],
    line: ['line', 'channel::line'],
    facebook: ['facebook', 'facebookpage', 'channel::facebook'],
    messenger: ['facebook', 'facebookpage', 'messenger', 'channel::facebook'],
    instagram: ['instagram', 'channel::instagram'],
    twitter: ['twitter', 'channel::twitter'],
    x: ['twitter', 'channel::twitter'],
    web: ['webwidget', 'website', 'channel::web'],
    website: ['webwidget', 'website', 'channel::web'],
    widget: ['webwidget', 'website', 'channel::web'],
    api: ['api', 'channel::api'],
  }
  return map[key] || [key]
}

function inboxMatchesChannel(inbox: InboxRow, hint: string): boolean {
  const matchers = channelMatchers(hint)
  const hay = `${inbox.channel_type || ''} ${inbox.medium || ''} ${inbox.name || ''}`.toLowerCase()
  return matchers.some((m) => hay.includes(m.replace(/^channel::/, '')))
}

async function listInboxes(connector: PartnerConnectorRuntime): Promise<InboxRow[]> {
  const data = (await chatwootFetch(connector, accountPath(connector, 'inboxes'))) as {
    payload?: InboxRow[]
  }
  return Array.isArray(data.payload) ? data.payload : []
}

async function resolveInboxId(
  connector: PartnerConnectorRuntime,
  channel?: string,
  inboxId?: number,
): Promise<number | undefined> {
  if (typeof inboxId === 'number' && Number.isFinite(inboxId)) return inboxId
  if (!channel?.trim()) return undefined

  const inboxes = await listInboxes(connector)
  const hit = inboxes.find((inbox) => inboxMatchesChannel(inbox, channel))
  if (!hit?.id) {
    const available = inboxes
      .map((i) => `${i.id}:${i.name || '?'}(${i.channel_type || i.medium || 'unknown'})`)
      .join(', ')
    throw new Error(
      `No Chatwoot inbox matched channel "${channel}". Available: ${available || '(none)'}`,
    )
  }
  return hit.id
}

function summarizeConversation(row: ConversationRow) {
  return {
    id: row.id,
    inbox_id: row.inbox_id,
    status: row.status,
    unread_count: row.unread_count ?? 0,
    channel: row.meta?.channel,
    contact: row.meta?.sender
      ? {
          id: row.meta.sender.id,
          name: row.meta.sender.name,
          email: row.meta.sender.email,
          phone: row.meta.sender.phone_number,
        }
      : null,
    last_message: row.last_non_activity_message?.content || null,
    last_activity_at: row.last_activity_at,
  }
}

async function listConversations(
  connector: PartnerConnectorRuntime,
  options: {
    status?: string
    inboxId?: number
    q?: string
    page?: number
  },
): Promise<ConversationRow[]> {
  const params = new URLSearchParams()
  params.set('status', options.status || 'open')
  params.set('assignee_type', 'all')
  params.set('page', String(options.page && options.page > 0 ? options.page : 1))
  if (options.inboxId) params.set('inbox_id', String(options.inboxId))
  if (options.q?.trim()) params.set('q', options.q.trim())

  const data = (await chatwootFetch(
    connector,
    accountPath(connector, `conversations?${params.toString()}`),
  )) as {
    data?: { payload?: ConversationRow[] }
    payload?: ConversationRow[]
  }

  if (Array.isArray(data.data?.payload)) return data.data.payload
  if (Array.isArray(data.payload)) return data.payload
  return []
}

export function chatwootAdapterTools(connector: PartnerConnectorRuntime): PartnerToolDefinition[] {
  const common = {
    connectorId: connector.id,
    connectorKind: 'chatwoot',
    connectorLabel: connector.label,
  }
  return [
    {
      ...common,
      name: 'chatwoot_list_unread',
      description:
        'List Chatwoot conversations with unread customer messages (any connected channel).',
      sideEffect: 'read',
      parameters: {
        type: 'object',
        properties: {
          channel: {
            type: 'string',
            description:
              'Optional channel filter: whatsapp, email, telegram, instagram, facebook, sms, web, twitter, line',
          },
          limit: { type: 'number', description: 'Max rows (default 20)' },
        },
      },
    },
    {
      ...common,
      name: 'chatwoot_list_conversations',
      description:
        'List Chatwoot conversations. Filter by channel (e.g. whatsapp) or inbox_id and status.',
      sideEffect: 'read',
      parameters: {
        type: 'object',
        properties: {
          channel: {
            type: 'string',
            description: 'Friendly channel name: whatsapp, email, telegram, instagram, etc.',
          },
          inbox_id: { type: 'number', description: 'Exact Chatwoot inbox id if known' },
          status: {
            type: 'string',
            description: 'open | resolved | pending | snoozed | all (default open)',
          },
          q: { type: 'string', description: 'Search text inside messages' },
          limit: { type: 'number', description: 'Max rows (default 20)' },
        },
      },
    },
    {
      ...common,
      name: 'chatwoot_list_inboxes',
      description: 'List Chatwoot inboxes (WhatsApp, Email, Website, etc.) with ids and channel types.',
      sideEffect: 'read',
      parameters: { type: 'object', properties: {} },
    },
    {
      ...common,
      name: 'chatwoot_find_contact',
      description: 'Search Chatwoot contacts by name, email, phone, or identifier (e.g. Rahim).',
      sideEffect: 'read',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Name, email, phone, or identifier' },
        },
        required: ['query'],
      },
    },
    {
      ...common,
      name: 'chatwoot_get_conversation',
      description: 'Get one Chatwoot conversation by id, including recent messages.',
      sideEffect: 'read',
      parameters: {
        type: 'object',
        properties: {
          conversation_id: { type: 'number', description: 'Conversation id' },
        },
        required: ['conversation_id'],
      },
    },
    {
      ...common,
      name: 'chatwoot_send_reply',
      description:
        'Send a public reply into a Chatwoot conversation (WhatsApp/email/etc.). Requires confirmation before execution.',
      sideEffect: 'write',
      parameters: {
        type: 'object',
        properties: {
          conversation_id: { type: 'number', description: 'Conversation id to reply in' },
          content: { type: 'string', description: 'Reply text to send to the customer' },
          private: {
            type: 'boolean',
            description: 'If true, post as private note (team-only). Default false (public reply).',
          },
        },
        required: ['conversation_id', 'content'],
      },
    },
  ]
}

export async function runChatwootAdapterTool(
  connector: PartnerConnectorRuntime,
  name: string,
  args: Record<string, unknown>,
): Promise<PartnerToolResult> {
  try {
    if (name === 'chatwoot_list_inboxes') {
      const inboxes = await listInboxes(connector)
      return {
        ok: true,
        name,
        connectorId: connector.id,
        connectorKind: 'chatwoot',
        data: {
          count: inboxes.length,
          inboxes: inboxes.map((i) => ({
            id: i.id,
            name: i.name,
            channel_type: i.channel_type,
            medium: i.medium,
            phone_number: i.phone_number,
          })),
        },
      }
    }

    if (name === 'chatwoot_list_unread' || name === 'chatwoot_list_conversations') {
      const limit = typeof args.limit === 'number' && args.limit > 0 ? Math.min(args.limit, 50) : 20
      const channel = typeof args.channel === 'string' ? args.channel : undefined
      const inboxIdArg = typeof args.inbox_id === 'number' ? args.inbox_id : undefined
      const status =
        name === 'chatwoot_list_unread'
          ? 'open'
          : typeof args.status === 'string' && args.status.trim()
            ? args.status.trim()
            : 'open'
      const q = typeof args.q === 'string' ? args.q : undefined
      const inboxId = await resolveInboxId(connector, channel, inboxIdArg)
      const rows = await listConversations(connector, { status, inboxId, q })
      const filtered =
        name === 'chatwoot_list_unread' ? rows.filter((r) => (r.unread_count ?? 0) > 0) : rows
      const conversations = filtered.slice(0, limit).map(summarizeConversation)

      return {
        ok: true,
        name,
        connectorId: connector.id,
        connectorKind: 'chatwoot',
        data: {
          count: conversations.length,
          channel: channel || null,
          inbox_id: inboxId || null,
          status,
          conversations,
        },
      }
    }

    if (name === 'chatwoot_find_contact') {
      const query = String(args.query || '').trim()
      if (!query) throw new Error('query is required')

      const data = (await chatwootFetch(
        connector,
        accountPath(connector, `contacts/search?q=${encodeURIComponent(query)}`),
      )) as {
        payload?: Array<{
          id?: number
          name?: string
          email?: string | null
          phone_number?: string | null
          identifier?: string | null
          conversations_count?: number
        }>
      }
      const contacts = Array.isArray(data.payload) ? data.payload : []

      // Attach open conversations for the top matches (up to 3)
      const enriched = []
      for (const contact of contacts.slice(0, 3)) {
        if (!contact.id) continue
        const convData = (await chatwootFetch(
          connector,
          accountPath(connector, `contacts/${contact.id}/conversations`),
        )) as { payload?: ConversationRow[] }
        const convs = Array.isArray(convData.payload) ? convData.payload : []
        enriched.push({
          id: contact.id,
          name: contact.name,
          email: contact.email,
          phone: contact.phone_number,
          identifier: contact.identifier,
          conversations: convs.slice(0, 5).map(summarizeConversation),
        })
      }

      return {
        ok: true,
        name,
        connectorId: connector.id,
        connectorKind: 'chatwoot',
        data: { query, count: contacts.length, contacts: enriched },
      }
    }

    if (name === 'chatwoot_get_conversation') {
      const conversationId = Number(args.conversation_id)
      if (!Number.isFinite(conversationId)) throw new Error('conversation_id is required')

      const details = (await chatwootFetch(
        connector,
        accountPath(connector, `conversations/${conversationId}`),
      )) as ConversationRow & { payload?: ConversationRow }

      const conversation = (details.payload || details) as ConversationRow

      const messagesData = (await chatwootFetch(
        connector,
        accountPath(connector, `conversations/${conversationId}/messages`),
      )) as {
        payload?: Array<{
          id?: number
          content?: string | null
          message_type?: number
          created_at?: number
          private?: boolean
          sender?: { name?: string; type?: string }
        }>
      }
      const messages = Array.isArray(messagesData.payload) ? messagesData.payload : []

      return {
        ok: true,
        name,
        connectorId: connector.id,
        connectorKind: 'chatwoot',
        data: {
          conversation: summarizeConversation(conversation),
          messages: messages.slice(-30).map((m) => ({
            id: m.id,
            content: m.content,
            message_type: m.message_type,
            private: m.private,
            created_at: m.created_at,
            sender: m.sender?.name || null,
          })),
        },
      }
    }

    if (name === 'chatwoot_send_reply') {
      const conversationId = Number(args.conversation_id)
      const content = String(args.content || '').trim()
      const isPrivate = Boolean(args.private)
      if (!Number.isFinite(conversationId)) throw new Error('conversation_id is required')
      if (!content) throw new Error('content is required')

      const created = await chatwootFetch(
        connector,
        accountPath(connector, `conversations/${conversationId}/messages`),
        {
          method: 'POST',
          body: JSON.stringify({
            content,
            message_type: 'outgoing',
            private: isPrivate,
          }),
        },
      )

      return {
        ok: true,
        name,
        connectorId: connector.id,
        connectorKind: 'chatwoot',
        data: {
          created,
          summary: isPrivate
            ? `Private note added to conversation ${conversationId}`
            : `Reply sent on conversation ${conversationId}`,
        },
      }
    }

    return {
      ok: false,
      name,
      connectorId: connector.id,
      connectorKind: 'chatwoot',
      error: `Unknown Chatwoot tool: ${name}`,
    }
  } catch (err) {
    return {
      ok: false,
      name,
      connectorId: connector.id,
      connectorKind: 'chatwoot',
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function probeChatwootAdapter(
  connector: PartnerConnectorRuntime,
): Promise<{ ok: boolean; message?: string }> {
  try {
    resolveAuth(connector)
    await listInboxes(connector)
    return { ok: true }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) }
  }
}
