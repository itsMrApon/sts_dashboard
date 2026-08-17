export type PipelineDirection = 'inbound' | 'outbound'

export type PartnerPipelineKind = 'medusa' | 'n8n' | 'erpnext' | 'chatwoot'

export type PartnerPipelineTool = {
  tool_name: string
  tool_category: PartnerPipelineKind
  integration_name: string
  message: string
  inboundPrompt?: string
  outboundPrompt?: string
}

function wrapPrompt(options: {
  kind: PartnerPipelineKind
  slash: string
  direction: PipelineDirection
  title: string
  tools: string[]
  body: string
}): string {
  const directionLine =
    options.direction === 'outbound'
      ? 'Direction: OUTBOUND. Push work from STS-AI into the connected Docker/app, then bring the result back into this chat.'
      : 'Direction: INBOUND. Read from the connected Docker/app and show the result here. Do not create or mutate unless the data is missing and you must look it up.'

  return [
    options.slash,
    '',
    `# ${options.direction.toUpperCase()} PIPELINE — ${options.title}`,
    `Active partner: ${options.kind}.`,
    'This account has exactly one connector for this partner. Use it. Do not ask which workspace, tenant, or environment.',
    directionLine,
    '',
    '## Tools you should prefer',
    ...options.tools.map((tool) => `- \`${tool}\``),
    '',
    options.body,
    '',
    '## Hard rules',
    '- Actually call the partner tools. Never invent IDs, URLs, stock counts, or sales totals.',
    '- Write/trigger tools need confirmation in the UI before they run.',
    '- If the partner is offline, say so in one sentence and stop.',
    '- Keep Bangla/Unicode text intact.',
    '- Finish with a short creator-facing answer: table, links, workflow name, and next action.',
  ].join('\n')
}

const N8N: PartnerPipelineTool[] = [
  {
    tool_name: 'start_named_workflow',
    tool_category: 'n8n',
    integration_name: 'n8n',
    message: 'Start the named n8n project',
    outboundPrompt: wrapPrompt({
      kind: 'n8n',
      slash: '/n8n',
      direction: 'outbound',
      title: 'Start a previously created n8n workflow by name',
      tools: ['n8n_list_workflows', 'n8n_execute_workflow', 'n8n_trigger_webhook'],
      body: [
        '## Goal',
        'The creator already built a workflow in n8n (example name: `x`, or a YouTube reel pipeline). Start THAT workflow now. Do not scaffold a new one.',
        '',
        '## Method',
        '1. Call `n8n_list_workflows` and fuzzy-match the name the creator gave (x, youtube reel, reel, shorts).',
        '2. If several match, pick the closest active workflow and say which one you chose.',
        '3. Confirm, then call `n8n_execute_workflow` with the workflow id/name. If execute is unavailable, trigger its production webhook via `n8n_trigger_webhook`.',
        '4. Pass a JSON body with `{ "source": "sts-ai", "requestedBy": "partner-assistant", "project": "<name>" }`.',
        '5. Report execution id, status, and any output URLs.',
      ].join('\n'),
    }),
  },
  {
    tool_name: 'fetch_workflow_result',
    tool_category: 'n8n',
    integration_name: 'n8n',
    message: 'Get the Drive / output link',
    inboundPrompt: wrapPrompt({
      kind: 'n8n',
      slash: '/n8n',
      direction: 'inbound',
      title: 'Read the latest n8n execution and show where the file lives',
      tools: ['n8n_list_workflows', 'n8n_list_executions', 'n8n_get_execution'],
      body: [
        '## Goal',
        'The creator wants the result of a workflow they already ran (YouTube reel, render, export). Find where the video/file is stored (Google Drive, URL, binary path) and show the link in this chat.',
        '',
        '## Method',
        '1. Resolve the workflow by name if given, else use the most recently executed workflow.',
        '2. Call `n8n_list_executions` for that workflow.',
        '3. Load the latest success with `n8n_get_execution`.',
        '4. Extract Drive URLs, file ids, webhook responses, or output JSON fields named url/link/file/drive.',
        '5. Reply with the clickable link and execution timestamp. If nothing stored, say so and show the raw output keys.',
      ].join('\n'),
    }),
  },
  {
    tool_name: 'list_automations',
    tool_category: 'n8n',
    integration_name: 'n8n',
    message: 'List my n8n automations',
    inboundPrompt: wrapPrompt({
      kind: 'n8n',
      slash: '/n8n',
      direction: 'inbound',
      title: 'Inventory every workflow on the connected n8n',
      tools: ['n8n_list_workflows'],
      body: [
        '## Goal',
        'Show every workflow: name, id, active/inactive, updated time. Group active vs paused.',
        '',
        '## Method',
        'Call `n8n_list_workflows` with a high limit. Present a compact table. Highlight anything named like reel, youtube, lead, or social.',
      ].join('\n'),
    }),
  },
  {
    tool_name: 'retry_failed_run',
    tool_category: 'n8n',
    integration_name: 'n8n',
    message: 'Replay the last failed run',
    outboundPrompt: wrapPrompt({
      kind: 'n8n',
      slash: '/n8n',
      direction: 'outbound',
      title: 'Re-trigger the workflow that last failed',
      tools: ['n8n_list_executions', 'n8n_get_execution', 'n8n_execute_workflow', 'n8n_trigger_webhook'],
      body: [
        '## Goal',
        'Find the most recent failed n8n execution, explain why it failed in one sentence, then re-run that same workflow after confirmation.',
        '',
        '## Method',
        '1. `n8n_list_executions` — prefer error/failed.',
        '2. `n8n_get_execution` for the error payload.',
        '3. Confirm, then `n8n_execute_workflow` (or webhook) for that workflow id.',
      ].join('\n'),
    }),
  },
  {
    tool_name: 'fire_lead_webhook',
    tool_category: 'n8n',
    integration_name: 'n8n',
    message: 'Push a lead into n8n',
    outboundPrompt: wrapPrompt({
      kind: 'n8n',
      slash: '/n8n',
      direction: 'outbound',
      title: 'Send STS lead payload into an n8n webhook',
      tools: ['n8n_list_workflows', 'n8n_trigger_webhook'],
      body: [
        '## Goal',
        'Outbound: take the current workspace/lead context and POST it into the n8n lead-ingest (or similarly named) webhook so the Docker n8n pipeline starts.',
        '',
        '## Method',
        'Find a workflow/webhook path like lead-ingest, inbound-lead, or crm. Confirm, then `n8n_trigger_webhook` with method POST and a body containing name, phone, source=sts-ai, and timestamp.',
      ].join('\n'),
    }),
  },
]

const MEDUSA: PartnerPipelineTool[] = [
  {
    tool_name: 'generate_todays_sales',
    tool_category: 'medusa',
    integration_name: 'Medusa.js',
    message: "Generate today's sale",
    outboundPrompt: wrapPrompt({
      kind: 'medusa',
      slash: '/medusa',
      direction: 'outbound',
      title: "Build today's sales sheet in Medusa and show it here",
      tools: ['medusa_sales_summary', 'medusa_list_orders'],
      body: [
        '## Goal',
        'Hit the connected Medusa Admin API, assemble TODAY\'s sales sheet (orders, units, revenue, top SKUs), and display it in this assistant. This is outbound: STS asks Medusa to compute/serve the sheet, then the sheet comes back.',
        '',
        '## Method',
        '1. Call `medusa_list_orders` with a high limit and `medusa_sales_summary`.',
        '2. Filter to the current local day when timestamps exist; otherwise label the window as "latest scanned orders" and say the limit.',
        '3. Build a markdown table: order id, status, units, total, currency.',
        '4. Add a totals row. If Medusa is empty, say zero sales — do not invent rows.',
      ].join('\n'),
    }),
  },
  {
    tool_name: 'check_stock_today',
    tool_category: 'medusa',
    integration_name: 'Medusa.js',
    message: 'Check the stock today',
    inboundPrompt: wrapPrompt({
      kind: 'medusa',
      slash: '/medusa',
      direction: 'inbound',
      title: 'Read Medusa inventory and flag low stock',
      tools: ['medusa_list_products', 'medusa_low_stock'],
      body: [
        '## Goal',
        'Inbound only: ask Medusa what is low on stock right now and show it in this chat. No catalog writes.',
        '',
        '## Method',
        '1. Call `medusa_low_stock` (threshold 5 unless the creator set another).',
        '2. If that tool is thin, also `medusa_list_products` and inspect variant inventory_quantity.',
        '3. Table: product, variant, quantity, status (out / low / ok).',
        '4. End with the 3 most urgent SKUs.',
      ].join('\n'),
    }),
  },
  {
    tool_name: 'recent_orders_board',
    tool_category: 'medusa',
    integration_name: 'Medusa.js',
    message: 'Show recent Medusa orders',
    inboundPrompt: wrapPrompt({
      kind: 'medusa',
      slash: '/medusa',
      direction: 'inbound',
      title: 'Pull the latest Medusa orders into chat',
      tools: ['medusa_list_orders'],
      body: [
        '## Goal',
        'Inbound: list the newest orders with status and totals. No fulfillment changes.',
        '',
        '## Method',
        'Call `medusa_list_orders`. Present id, status, item_count, total, currency. Mention if any are pending/canceled.',
      ].join('\n'),
    }),
  },
  {
    tool_name: 'catalog_snapshot',
    tool_category: 'medusa',
    integration_name: 'Medusa.js',
    message: 'Snapshot the catalog',
    inboundPrompt: wrapPrompt({
      kind: 'medusa',
      slash: '/medusa',
      direction: 'inbound',
      title: 'Read the live Medusa product catalog',
      tools: ['medusa_list_products'],
      body: [
        '## Goal',
        'Inbound: dump a compact catalog snapshot (title, variants, whether published).',
        '',
        '## Method',
        'Call `medusa_list_products`. Group by status. Do not create products.',
      ].join('\n'),
    }),
  },
  {
    tool_name: 'sales_vs_stock',
    tool_category: 'medusa',
    integration_name: 'Medusa.js',
    message: 'Compare sales vs stock',
    outboundPrompt: wrapPrompt({
      kind: 'medusa',
      slash: '/medusa',
      direction: 'outbound',
      title: 'Join today\'s sales with inventory and brief the creator',
      tools: ['medusa_sales_summary', 'medusa_list_orders', 'medusa_low_stock', 'medusa_list_products'],
      body: [
        '## Goal',
        'Outbound briefing: pull sales + stock from Medusa, then return a restock recommendation in this chat.',
        '',
        '## Method',
        'Run sales summary, recent orders, and low stock. Cross SKUs that sold with SKUs that are low. Recommend restock quantity in plain language. No inventory writes.',
      ].join('\n'),
    }),
  },
]

const ERPNEXT: PartnerPipelineTool[] = [
  {
    tool_name: 'pos_coffee_sale',
    tool_category: 'erpnext',
    integration_name: 'ERPNext',
    message: 'Ring up a POS sale',
    outboundPrompt: wrapPrompt({
      kind: 'erpnext',
      slash: '/erpnext',
      direction: 'outbound',
      title: 'Create a POS invoice in ERPNext (e.g. 1 coffee)',
      tools: ['erpnext_find_item', 'erpnext_create_pos_invoice'],
      body: [
        '## Goal',
        'Outbound: send a sale into the ERPNext Docker POS. Example: 1 cup of coffee for Walking Customer.',
        '',
        '## Method',
        '1. `erpnext_find_item` for coffee / the named item.',
        '2. Confirm, then `erpnext_create_pos_invoice` with qty and item_code.',
        '3. Return invoice name, grand total, and stock effect if present.',
      ].join('\n'),
    }),
  },
  {
    tool_name: 'low_stock_watch',
    tool_category: 'erpnext',
    integration_name: 'ERPNext',
    message: 'Check ERPNext low stock',
    inboundPrompt: wrapPrompt({
      kind: 'erpnext',
      slash: '/erpnext',
      direction: 'inbound',
      title: 'Read Bin/Item stock and list what is low',
      tools: ['erpnext_low_stock', 'erpnext_find_item'],
      body: [
        '## Goal',
        'Inbound: what items are below the safety threshold in ERPNext right now?',
        '',
        '## Method',
        'Call `erpnext_low_stock` (default qty < 5). Table item_code, actual_qty, warehouse. Flag zeros first.',
      ].join('\n'),
    }),
  },
  {
    tool_name: 'open_invoices',
    tool_category: 'erpnext',
    integration_name: 'ERPNext',
    message: 'List open invoices',
    inboundPrompt: wrapPrompt({
      kind: 'erpnext',
      slash: '/erpnext',
      direction: 'inbound',
      title: 'Read unpaid / draft ERPNext invoices',
      tools: ['erpnext_list_open_invoices'],
      body: [
        '## Goal',
        'Inbound: show open Sales Invoices / POS drafts with outstanding amounts.',
        '',
        '## Method',
        'Call `erpnext_list_open_invoices`. Table name, customer, status, grand_total, outstanding.',
      ].join('\n'),
    }),
  },
  {
    tool_name: 'lookup_item',
    tool_category: 'erpnext',
    integration_name: 'ERPNext',
    message: 'Look up an ERPNext item',
    inboundPrompt: wrapPrompt({
      kind: 'erpnext',
      slash: '/erpnext',
      direction: 'inbound',
      title: 'Find an Item by name or code',
      tools: ['erpnext_find_item'],
      body: [
        '## Goal',
        'Inbound: resolve the item the creator named (coffee, SKU, Bangla name) and show code, rate, stock if included.',
        '',
        '## Method',
        'Call `erpnext_find_item`. If multiple, list top 5 matches and recommend one.',
      ].join('\n'),
    }),
  },
  {
    tool_name: 'today_pos_brief',
    tool_category: 'erpnext',
    integration_name: 'ERPNext',
    message: "ERPNext today's POS brief",
    outboundPrompt: wrapPrompt({
      kind: 'erpnext',
      slash: '/erpnext',
      direction: 'outbound',
      title: 'Pull POS/sales documents and brief today',
      tools: ['erpnext_list_open_invoices', 'erpnext_low_stock'],
      body: [
        '## Goal',
        'Outbound briefing from ERPNext: today\'s POS/invoice picture plus stock risk.',
        '',
        '## Method',
        'Read open invoices and low stock. Summarize cash still outstanding and items that will block POS. No new invoices unless the creator asked to ring a sale.',
      ].join('\n'),
    }),
  },
]

const CHATWOOT: PartnerPipelineTool[] = [
  {
    tool_name: 'unread_inbox',
    tool_category: 'chatwoot',
    integration_name: 'Chatwoot',
    message: 'Show unread / WhatsApp messages',
    inboundPrompt: wrapPrompt({
      kind: 'chatwoot',
      slash: '/chatwoot',
      direction: 'inbound',
      title: 'Read Chatwoot unread conversations including WhatsApp',
      tools: ['chatwoot_list_unread', 'chatwoot_list_conversations', 'chatwoot_list_inboxes'],
      body: [
        '## Goal',
        'Inbound: what new messages landed in Chatwoot (WhatsApp, email, web)? Show who, channel, preview, waiting time.',
        '',
        '## Method',
        'Call `chatwoot_list_unread` and `chatwoot_list_inboxes`. Prefer WhatsApp rows first. Do not reply yet.',
      ].join('\n'),
    }),
  },
  {
    tool_name: 'send_inbox_reply',
    tool_category: 'chatwoot',
    integration_name: 'Chatwoot',
    message: 'Reply in Chatwoot',
    outboundPrompt: wrapPrompt({
      kind: 'chatwoot',
      slash: '/chatwoot',
      direction: 'outbound',
      title: 'Send a confirmed reply into Chatwoot',
      tools: ['chatwoot_list_unread', 'chatwoot_get_conversation', 'chatwoot_send_reply'],
      body: [
        '## Goal',
        'Outbound: take the reply the creator wants and send it through Chatwoot to the customer (WhatsApp/email/web).',
        '',
        '## Method',
        'Resolve conversation id from unread/list. Draft the reply. Confirm, then `chatwoot_send_reply`. Report conversation id and delivery.',
      ].join('\n'),
    }),
  },
  {
    tool_name: 'find_contact',
    tool_category: 'chatwoot',
    integration_name: 'Chatwoot',
    message: 'Find a Chatwoot contact',
    inboundPrompt: wrapPrompt({
      kind: 'chatwoot',
      slash: '/chatwoot',
      direction: 'inbound',
      title: 'Lookup a contact by name, phone, or email',
      tools: ['chatwoot_find_contact'],
      body: [
        '## Goal',
        'Inbound: find the contact and show id, channels, last activity. No writes.',
        '',
        '## Method',
        'Call `chatwoot_find_contact` with the query the creator typed.',
      ].join('\n'),
    }),
  },
  {
    tool_name: 'conversation_thread',
    tool_category: 'chatwoot',
    integration_name: 'Chatwoot',
    message: 'Open a conversation thread',
    inboundPrompt: wrapPrompt({
      kind: 'chatwoot',
      slash: '/chatwoot',
      direction: 'inbound',
      title: 'Read one Chatwoot conversation in full',
      tools: ['chatwoot_get_conversation', 'chatwoot_list_conversations'],
      body: [
        '## Goal',
        'Inbound: load the conversation the creator named and summarize the last messages.',
        '',
        '## Method',
        'Find id via list if needed, then `chatwoot_get_conversation`. Quote the latest customer line.',
      ].join('\n'),
    }),
  },
  {
    tool_name: 'inbox_health',
    tool_category: 'chatwoot',
    integration_name: 'Chatwoot',
    message: 'Chatwoot inbox health',
    inboundPrompt: wrapPrompt({
      kind: 'chatwoot',
      slash: '/chatwoot',
      direction: 'inbound',
      title: 'List inboxes and waiting conversations',
      tools: ['chatwoot_list_inboxes', 'chatwoot_list_conversations'],
      body: [
        '## Goal',
        'Inbound ops snapshot: which inboxes exist (WhatsApp/email/web) and how many open conversations sit in each.',
        '',
        '## Method',
        'Call both list tools. Table inbox name, channel, open count.',
      ].join('\n'),
    }),
  },
]

const BY_KIND: Record<PartnerPipelineKind, PartnerPipelineTool[]> = {
  n8n: N8N,
  medusa: MEDUSA,
  erpnext: ERPNEXT,
  chatwoot: CHATWOOT,
}

export function getPartnerPipelineTools(kind: string): PartnerPipelineTool[] {
  const key = kind === 'saleor' ? 'medusa' : kind
  if (key === 'medusa' || key === 'n8n' || key === 'erpnext' || key === 'chatwoot') {
    return BY_KIND[key]
  }
  return []
}

export type PipelinePromptPick = {
  id: string
  kind: PartnerPipelineKind
  integrationName: string
  direction: PipelineDirection
  title: string
  prompt: string
}

/** Flatten inbound/outbound prompts for the assistant picker. */
export function listPipelinePrompts(kinds?: string[]): PipelinePromptPick[] {
  const wanted =
    kinds && kinds.length > 0
      ? kinds.map((kind) => (kind === 'saleor' ? 'medusa' : kind))
      : (Object.keys(BY_KIND) as PartnerPipelineKind[])

  const seen = new Set<string>()
  const picks: PipelinePromptPick[] = []

  for (const raw of wanted) {
    if (raw !== 'medusa' && raw !== 'n8n' && raw !== 'erpnext' && raw !== 'chatwoot') continue
    if (seen.has(raw)) continue
    seen.add(raw)

    for (const tool of BY_KIND[raw]) {
      if (tool.outboundPrompt) {
        picks.push({
          id: `${raw}-outbound-${tool.tool_name}`,
          kind: raw,
          integrationName: tool.integration_name,
          direction: 'outbound',
          title: tool.message,
          prompt: tool.outboundPrompt,
        })
      }
      if (tool.inboundPrompt) {
        picks.push({
          id: `${raw}-inbound-${tool.tool_name}`,
          kind: raw,
          integrationName: tool.integration_name,
          direction: 'inbound',
          title: tool.message,
          prompt: tool.inboundPrompt,
        })
      }
    }
  }

  return picks
}
