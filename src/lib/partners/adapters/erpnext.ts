import type { PartnerConnectorRuntime, PartnerToolDefinition, PartnerToolResult } from '../types'

function baseUrl(connector: PartnerConnectorRuntime): string {
  return connector.mcpUrl.replace(/\/mcp\/?$/, '').replace(/\/$/, '')
}

function authHeaders(connector: PartnerConnectorRuntime): Record<string, string> {
  const secret =
    connector.authSecret?.trim() ||
    (() => {
      const key = process.env.ERPNEXT_API_KEY?.trim()
      const sec = process.env.ERPNEXT_API_SECRET?.trim()
      if (key && sec) return `${key}:${sec}`
      return ''
    })()

  if (!secret) return {}

  // Support "api_key:api_secret" → Frappe token auth
  if (secret.includes(':') && !secret.toLowerCase().startsWith('token ')) {
    return { Authorization: `token ${secret}` }
  }
  if (secret.toLowerCase().startsWith('token ')) {
    return { Authorization: secret }
  }
  return { Authorization: `Bearer ${secret}` }
}

async function erpFetch(
  connector: PartnerConnectorRuntime,
  path: string,
  init?: RequestInit,
): Promise<unknown> {
  const url = `${baseUrl(connector)}${path}`
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...authHeaders(connector),
      ...(init?.headers as Record<string, string> | undefined),
    },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`ERPNext HTTP ${res.status}: ${text.slice(0, 240) || res.statusText}`)
  }
  return res.json()
}

export function erpnextAdapterTools(connector: PartnerConnectorRuntime): PartnerToolDefinition[] {
  const common = {
    connectorId: connector.id,
    connectorKind: 'erpnext',
    connectorLabel: connector.label,
  }
  return [
    {
      ...common,
      name: 'erpnext_find_item',
      description: 'Find ERPNext Item by name/code (e.g. coffee).',
      sideEffect: 'read',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Item name or item code search text' },
        },
        required: ['query'],
      },
    },
    {
      ...common,
      name: 'erpnext_list_open_invoices',
      description: 'List recent open Sales Invoices / POS drafts in ERPNext.',
      sideEffect: 'read',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max rows (default 10)' },
        },
      },
    },
    {
      ...common,
      name: 'erpnext_create_pos_invoice',
      description:
        'Create a POS Invoice in ERPNext for a quantity of an item (e.g. 1 cup of coffee). Requires confirmation before execution.',
      sideEffect: 'write',
      parameters: {
        type: 'object',
        properties: {
          item_code: {
            type: 'string',
            description: 'Exact Item Code if known',
          },
          item_name: {
            type: 'string',
            description: 'Item name to search when item_code is unknown (e.g. coffee)',
          },
          qty: { type: 'number', description: 'Quantity (default 1)' },
          customer: {
            type: 'string',
            description: 'Customer name/id (optional; uses Walking Customer when omitted)',
          },
          company: { type: 'string', description: 'Company name override (optional)' },
          pos_profile: { type: 'string', description: 'POS Profile name (optional)' },
        },
      },
    },
    {
      ...common,
      name: 'erpnext_low_stock',
      description: 'Read ERPNext Bin quantities and list items below a threshold.',
      sideEffect: 'read',
      parameters: {
        type: 'object',
        properties: {
          threshold: {
            type: 'number',
            description: 'Flag bins with actual_qty below this value (default 5)',
          },
          limit: { type: 'number', description: 'Max rows (default 50)' },
        },
      },
    },
  ]
}

async function resolveItem(
  connector: PartnerConnectorRuntime,
  itemCode?: string,
  itemName?: string,
): Promise<{ item_code: string; item_name?: string; rate?: number }> {
  if (itemCode?.trim()) {
    const data = (await erpFetch(
      connector,
      `/api/resource/Item/${encodeURIComponent(itemCode.trim())}`,
    )) as { data?: { item_code?: string; item_name?: string; standard_rate?: number } }
    const row = data.data
    if (!row?.item_code) throw new Error(`Item not found: ${itemCode}`)
    return {
      item_code: row.item_code,
      item_name: row.item_name,
      rate: row.standard_rate,
    }
  }

  const query = itemName?.trim()
  if (!query) throw new Error('item_code or item_name is required')

  const filters = encodeURIComponent(
    JSON.stringify([['item_name', 'like', `%${query}%`]]),
  )
  const fields = encodeURIComponent(JSON.stringify(['name', 'item_code', 'item_name', 'standard_rate']))
  const list = (await erpFetch(
    connector,
    `/api/resource/Item?filters=${filters}&fields=${fields}&limit_page_length=5`,
  )) as {
    data?: Array<{ name?: string; item_code?: string; item_name?: string; standard_rate?: number }>
  }
  const hit = list.data?.[0]
  if (!hit?.item_code && !hit?.name) {
    throw new Error(`No ERPNext item matched "${query}"`)
  }
  return {
    item_code: hit.item_code || hit.name || query,
    item_name: hit.item_name,
    rate: hit.standard_rate,
  }
}

export async function runErpnextAdapterTool(
  connector: PartnerConnectorRuntime,
  name: string,
  args: Record<string, unknown>,
): Promise<PartnerToolResult> {
  try {
    if (name === 'erpnext_find_item') {
      const query = String(args.query || '')
      const item = await resolveItem(connector, undefined, query)
      return { ok: true, name, connectorId: connector.id, connectorKind: 'erpnext', data: item }
    }

    if (name === 'erpnext_list_open_invoices') {
      const limit = typeof args.limit === 'number' ? args.limit : 10
      const fields = encodeURIComponent(
        JSON.stringify(['name', 'customer', 'grand_total', 'status', 'posting_date', 'is_pos']),
      )
      const data = await erpFetch(
        connector,
        `/api/resource/POS%20Invoice?fields=${fields}&limit_page_length=${limit}&order_by=modified%20desc`,
      )
      return { ok: true, name, connectorId: connector.id, connectorKind: 'erpnext', data }
    }

    if (name === 'erpnext_low_stock') {
      const threshold = typeof args.threshold === 'number' ? args.threshold : 5
      const limit = typeof args.limit === 'number' ? args.limit : 50
      const fields = encodeURIComponent(
        JSON.stringify(['name', 'item_code', 'warehouse', 'actual_qty']),
      )
      const filters = encodeURIComponent(JSON.stringify([['actual_qty', '<', threshold]]))
      const data = (await erpFetch(
        connector,
        `/api/resource/Bin?fields=${fields}&filters=${filters}&limit_page_length=${limit}&order_by=actual_qty%20asc`,
      )) as {
        data?: Array<{
          name?: string
          item_code?: string
          warehouse?: string
          actual_qty?: number
        }>
      }
      const rows = Array.isArray(data.data) ? data.data : []
      return {
        ok: true,
        name,
        connectorId: connector.id,
        connectorKind: 'erpnext',
        data: {
          threshold,
          count: rows.length,
          items: rows.map((row) => ({
            item_code: row.item_code,
            warehouse: row.warehouse,
            actual_qty: row.actual_qty,
            status: (row.actual_qty ?? 0) <= 0 ? 'out' : 'low',
          })),
        },
      }
    }

    if (name === 'erpnext_create_pos_invoice') {
      const qty = typeof args.qty === 'number' && args.qty > 0 ? args.qty : 1
      const item = await resolveItem(
        connector,
        typeof args.item_code === 'string' ? args.item_code : undefined,
        typeof args.item_name === 'string' ? args.item_name : 'coffee',
      )

      const customer =
        (typeof args.customer === 'string' && args.customer.trim()) ||
        process.env.ERPNEXT_DEFAULT_CUSTOMER?.trim() ||
        'Walking Customer'
      const company =
        (typeof args.company === 'string' && args.company.trim()) ||
        process.env.ERPNEXT_DEFAULT_COMPANY?.trim() ||
        undefined
      const posProfile =
        (typeof args.pos_profile === 'string' && args.pos_profile.trim()) ||
        process.env.ERPNEXT_POS_PROFILE?.trim() ||
        undefined

      const doc: Record<string, unknown> = {
        doctype: 'POS Invoice',
        customer,
        is_pos: 1,
        update_stock: 1,
        items: [
          {
            item_code: item.item_code,
            qty,
            rate: item.rate ?? 0,
          },
        ],
      }
      if (company) doc.company = company
      if (posProfile) doc.pos_profile = posProfile

      const created = await erpFetch(connector, '/api/resource/POS%20Invoice', {
        method: 'POST',
        body: JSON.stringify({ data: doc }),
      })

      return {
        ok: true,
        name,
        connectorId: connector.id,
        connectorKind: 'erpnext',
        data: {
          created,
          summary: `POS Invoice created for ${qty} × ${item.item_name || item.item_code}`,
          note: 'Physical print depends on URY/ERPNext POS print settings.',
        },
      }
    }

    return {
      ok: false,
      name,
      connectorId: connector.id,
      connectorKind: 'erpnext',
      error: `Unknown ERPNext tool: ${name}`,
    }
  } catch (err) {
    return {
      ok: false,
      name,
      connectorId: connector.id,
      connectorKind: 'erpnext',
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function probeErpnextAdapter(
  connector: PartnerConnectorRuntime,
): Promise<{ ok: boolean; message?: string }> {
  try {
    await erpFetch(connector, '/api/method/frappe.auth.get_logged_user')
    return { ok: true }
  } catch (err) {
    // Some sites block that method; try Item list as fallback
    try {
      await erpFetch(connector, '/api/resource/Item?limit_page_length=1')
      return { ok: true }
    } catch (err2) {
      return { ok: false, message: err2 instanceof Error ? err2.message : String(err) }
    }
  }
}
