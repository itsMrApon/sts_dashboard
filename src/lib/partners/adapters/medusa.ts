import type { PartnerConnectorRuntime, PartnerToolDefinition, PartnerToolResult } from '../types'

function baseUrl(connector: PartnerConnectorRuntime): string {
  return connector.mcpUrl.replace(/\/mcp\/?$/, '').replace(/\/$/, '')
}

function authHeaders(connector: PartnerConnectorRuntime): Record<string, string> {
  const secret =
    connector.authSecret?.trim() || process.env.MEDUSA_ADMIN_TOKEN?.trim() || ''
  if (!secret) return {}
  return { Authorization: `Bearer ${secret}` }
}

async function medusaFetch(
  connector: PartnerConnectorRuntime,
  path: string,
): Promise<unknown> {
  const url = `${baseUrl(connector)}${path}`
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(connector),
    },
    signal: AbortSignal.timeout(12000),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Medusa HTTP ${res.status}: ${text.slice(0, 200) || res.statusText}`)
  }
  return res.json()
}

export function medusaAdapterTools(connector: PartnerConnectorRuntime): PartnerToolDefinition[] {
  const common = {
    connectorId: connector.id,
    connectorKind: 'medusa',
    connectorLabel: connector.label,
  }
  return [
    {
      ...common,
      name: 'medusa_sales_summary',
      description:
        'Summarize how many items/orders have been sold in Medusa (order count and total quantity).',
      sideEffect: 'read',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Max orders to scan (default 50)',
          },
        },
      },
    },
    {
      ...common,
      name: 'medusa_list_orders',
      description: 'List recent Medusa orders with totals and item counts.',
      sideEffect: 'read',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max orders (default 20)' },
        },
      },
    },
    {
      ...common,
      name: 'medusa_list_products',
      description: 'List Medusa products with titles and variants.',
      sideEffect: 'read',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max products (default 20)' },
          q: { type: 'string', description: 'Optional search query' },
        },
      },
    },
    {
      ...common,
      name: 'medusa_low_stock',
      description:
        'Read Medusa variant inventory and list SKUs at or below a quantity threshold.',
      sideEffect: 'read',
      parameters: {
        type: 'object',
        properties: {
          threshold: {
            type: 'number',
            description: 'Flag variants with inventory_quantity <= this value (default 5)',
          },
          limit: { type: 'number', description: 'Max products to scan (default 50)' },
        },
      },
    },
  ]
}

export async function runMedusaAdapterTool(
  connector: PartnerConnectorRuntime,
  name: string,
  args: Record<string, unknown>,
): Promise<PartnerToolResult> {
  try {
    if (name === 'medusa_list_products' || name === 'medusa_low_stock') {
      const limit =
        typeof args.limit === 'number' ? args.limit : name === 'medusa_low_stock' ? 50 : 20
      const q = typeof args.q === 'string' ? args.q : ''
      const qs = new URLSearchParams({
        limit: String(limit),
        fields: '*variants',
      })
      if (q) qs.set('q', q)
      const data = (await medusaFetch(connector, `/admin/products?${qs}`)) as {
        products?: Array<{
          id?: string
          title?: string
          status?: string
          variants?: Array<{
            id?: string
            title?: string
            sku?: string
            inventory_quantity?: number
            manage_inventory?: boolean
          }>
        }>
        count?: number
      }

      if (name === 'medusa_list_products') {
        return { ok: true, name, connectorId: connector.id, connectorKind: 'medusa', data }
      }

      const threshold = typeof args.threshold === 'number' ? args.threshold : 5
      const rows: Array<{
        product: string
        variant: string
        sku?: string
        quantity: number
        status: 'out' | 'low'
      }> = []
      for (const product of data.products || []) {
        for (const variant of product.variants || []) {
          if (typeof variant.inventory_quantity !== 'number') continue
          if (variant.inventory_quantity > threshold) continue
          rows.push({
            product: product.title || product.id || 'product',
            variant: variant.title || variant.id || 'variant',
            sku: variant.sku,
            quantity: variant.inventory_quantity,
            status: variant.inventory_quantity <= 0 ? 'out' : 'low',
          })
        }
      }
      rows.sort((a, b) => a.quantity - b.quantity)
      return {
        ok: true,
        name,
        connectorId: connector.id,
        connectorKind: 'medusa',
        data: {
          threshold,
          scannedProducts: data.products?.length ?? 0,
          lowCount: rows.length,
          items: rows,
        },
      }
    }

    if (name === 'medusa_list_orders' || name === 'medusa_sales_summary') {
      const limit =
        typeof args.limit === 'number' ? args.limit : name === 'medusa_sales_summary' ? 50 : 20
      const data = (await medusaFetch(
        connector,
        `/admin/orders?limit=${limit}&fields=*items`,
      )) as {
        orders?: Array<{
          id?: string
          display_id?: number
          status?: string
          currency_code?: string
          total?: number
          items?: Array<{ quantity?: number; title?: string }>
        }>
        count?: number
      }

      const orders = Array.isArray(data.orders) ? data.orders : []
      if (name === 'medusa_list_orders') {
        return {
          ok: true,
          name,
          connectorId: connector.id,
          connectorKind: 'medusa',
          data: {
            count: data.count ?? orders.length,
            orders: orders.map((o) => ({
              id: o.id,
              display_id: o.display_id,
              status: o.status,
              total: o.total,
              currency_code: o.currency_code,
              item_count: (o.items ?? []).reduce((sum, i) => sum + (i.quantity ?? 0), 0),
            })),
          },
        }
      }

      const unitsSold = orders.reduce(
        (sum, o) => sum + (o.items ?? []).reduce((s, i) => s + (i.quantity ?? 0), 0),
        0,
      )
      return {
        ok: true,
        name,
        connectorId: connector.id,
        connectorKind: 'medusa',
        data: {
          orderCount: data.count ?? orders.length,
          scannedOrders: orders.length,
          unitsSold,
          note:
            'unitsSold is summed from scanned recent orders. Raise limit for a broader window.',
        },
      }
    }

    return {
      ok: false,
      name,
      connectorId: connector.id,
      connectorKind: 'medusa',
      error: `Unknown Medusa tool: ${name}`,
    }
  } catch (err) {
    return {
      ok: false,
      name,
      connectorId: connector.id,
      connectorKind: 'medusa',
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function probeMedusaAdapter(
  connector: PartnerConnectorRuntime,
): Promise<{ ok: boolean; message?: string }> {
  try {
    await medusaFetch(connector, '/admin/products?limit=1')
    return { ok: true }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) }
  }
}
