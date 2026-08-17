import { NextResponse } from 'next/server'
import { onAuthenticateUser } from '@/actions/auth'
import { generateReplyWithTools, summarizeToolResults } from '@/lib/messages/geminiText'
import { loadServiceContext } from '@/lib/tenants/loadServiceContext'
import {
  getConnectorLabel,
  normalizePartnerKind,
  promptSuggestionsForServices,
  type CustomMcpConnector,
} from '@/lib/tenants/tenantServices'
import {
  cancelPendingProposal,
  consumePendingProposal,
  createPendingProposal,
  getPendingProposal,
} from '@/lib/partners/pendingProposals'
import {
  classifyPartnerTurn,
  PARTNER_OFF_TOPIC_REPLY,
} from '@/lib/partners/partnerChain'
import {
  extractPartnerPrefixes,
  resolvePartnerServices,
} from '@/lib/partners/slashCommands'
import {
  buildPartnerToolBundle,
  executePartnerTool,
  findToolDefinition,
  type PartnerToolBundle,
} from '@/lib/partners/toolRegistry'
import type { PendingProposalTool } from '@/lib/partners/types'

type HistoryMessage = { role: 'user' | 'assistant'; content: string }

type AssistantBody = {
  tenantId?: string
  workspaceId?: string
  services?: string[]
  customConnectors?: CustomMcpConnector[]
  message?: string
  sessionId?: string
  history?: HistoryMessage[]
  confirmProposalId?: string
  cancelProposalId?: string
}

function partnerSelected(services: string[], kind: string): boolean {
  return services.some((id) => normalizePartnerKind(id) === kind)
}

function resolveAssistantServices(message: string, requested: string[], historyText = ''): string[] {
  if (requested.length > 0) return requested
  const prefixes = extractPartnerPrefixes([message, historyText].filter(Boolean).join('\n\n'))
  if (prefixes.length === 0) return []
  return resolvePartnerServices({ prefixes, connectedPartners: [] })
}

function buildSystemPrompt(options: {
  workspaceName: string
  workspaceId: string
  publishProfile: { id: string; name: string } | null
  connectorLabels: string
  services: string[]
  serviceContext: Record<string, unknown>
}): string {
  const usesMedusa = partnerSelected(options.services, 'medusa')
  const usesErpnext = partnerSelected(options.services, 'erpnext')
  const usesN8n = partnerSelected(options.services, 'n8n')
  const usesFirecrawl = partnerSelected(options.services, 'firecrawl')
  const usesChatwoot = partnerSelected(options.services, 'chatwoot')
  const usesNextjs = partnerSelected(options.services, 'nextjs')
  const kinds: string[] = []
  if (usesMedusa) kinds.push('medusa')
  if (usesN8n) kinds.push('n8n')
  if (usesErpnext) kinds.push('erpnext')
  if (usesChatwoot) kinds.push('chatwoot')
  if (usesFirecrawl) kinds.push('firecrawl')

  return [
    'You are the STS-AI partner assistant for creators.',
    `Workspace: ${options.workspaceName} (${options.workspaceId}).`,
    options.publishProfile
      ? `Publish profile: ${options.publishProfile.name} (${options.publishProfile.id}).`
      : 'Publish profile: not linked.',
    kinds.length > 0
      ? `ACTIVE PARTNER THIS TURN: ${kinds.join(', ')}.`
      : 'No partner was selected.',
    `Connected partner APIs: ${options.connectorLabels}.`,
    'You are a pipeline runner, not a free agent. Run one chain and stop: parse intent → call the listed partner APIs → format the real results → return.',
    'Do not plan extra steps, do not browse unrelated tools, do not role-play a general chatbot.',
    'Each account has exactly one connector per partner (one n8n, one Medusa, etc.). Never ask which workspace, tenant, instance, or environment to use.',
    'If the user message starts with /n8n (or says Active partner: n8n), you MUST use n8n tools. Same rule for /medusa, /erpnext, /chatwoot.',
    'If the prompt lists preferred tools, call those in order. Fill arguments from the user text (workflow name, SKU, conversation id).',
    'Read tools may run automatically. Write/mutating tools require the user to confirm in the UI before execution — describe what you will do clearly.',
    'If the request is not about a connected partner, do not invent an answer. Say they do not need / for small talk, and point them at n8n, Medusa, ERPNext, or Chatwoot.',
    usesMedusa
      ? 'When Medusa is selected, use Medusa tools for sales sheets, orders, catalog, and low stock. Do not invent revenue or inventory.'
      : null,
    usesErpnext
      ? 'When ERPNext is selected, use ERPNext tools for inventory, open invoices, and POS (e.g. 1 cup of coffee).'
      : null,
    usesN8n
      ? 'When n8n is selected, list/match workflows by name, execute or webhook-trigger them, and read executions for output/Drive links. The workflow already exists in n8n — start it, do not scaffold a new one unless asked.'
      : null,
    usesFirecrawl
      ? 'When Firecrawl is selected, answer crawl/content questions using firecrawlMcp in the JSON context.'
      : null,
    usesChatwoot
      ? 'When Chatwoot is selected, use Chatwoot tools for unread messages, WhatsApp/email/social inbox conversations, contact lookup, and replies (confirm before send).'
      : null,
    usesNextjs
      ? 'When Next.js is selected, answer site/MCP routing questions using nextjsMcp in the JSON context.'
      : null,
    'Use tenantMcp for publish profile, blog, messages, and generic workspace MCP resources.',
    'Be concise and actionable. Keep Bangla/Unicode intact.',
    '',
    'Service context (JSON):',
    JSON.stringify(options.serviceContext, null, 2),
  ]
    .filter(Boolean)
    .join('\n')
}

async function runReadTools(
  bundle: PartnerToolBundle,
  calls: Array<{ name: string; args: Record<string, unknown> }>,
) {
  const results = []
  for (const call of calls) {
    const result = await executePartnerTool({
      bundle,
      name: call.name,
      args: call.args,
    })
    results.push({ name: call.name, result })
  }
  return results
}

export async function POST(req: Request) {
  const auth = await onAuthenticateUser()
  if (!auth.user) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
  }

  const body = (await req.json()) as AssistantBody
  const workspaceId =
    (typeof body.workspaceId === 'string' ? body.workspaceId.trim() : '') ||
    (typeof body.tenantId === 'string' ? body.tenantId.trim() : '')
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId : ''
  const requestedServices = Array.isArray(body.services) ? body.services.filter(Boolean) : []
  const customConnectors = Array.isArray(body.customConnectors) ? body.customConnectors : []
  const history = Array.isArray(body.history) ? body.history : []
  const historyText = history.map((item) => item.content || '').join('\n')
  const services = resolveAssistantServices(message, requestedServices, historyText)
  const confirmProposalId =
    typeof body.confirmProposalId === 'string' ? body.confirmProposalId.trim() : ''
  const cancelProposalId =
    typeof body.cancelProposalId === 'string' ? body.cancelProposalId.trim() : ''

  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
  }
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
  }

  const { prismaClient } = await import('@/lib/prismaClient')
  const tenant = await prismaClient.workspace.findFirst({
    where: { id: workspaceId, userId: auth.user.id },
    include: { publishProfile: { select: { id: true, name: true } } },
  })

  if (!tenant) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  }

  const partnerKinds = services
    .map(normalizePartnerKind)
    .filter(
      (s) =>
        ['medusa', 'erpnext', 'n8n', 'firecrawl', 'chatwoot'].includes(s) ||
        s.startsWith('custom:'),
    )

  const bundle =
    partnerKinds.length > 0
      ? await buildPartnerToolBundle(workspaceId, auth.user.id, services)
      : { tools: [], statuses: [], byToolName: new Map() }

  const serviceContext = await loadServiceContext(
    workspaceId,
    services,
    customConnectors,
    bundle.statuses,
  )

  const connectorLabels =
    services.length > 0
      ? services.map((id) => getConnectorLabel(id, customConnectors)).join(', ')
      : 'None (workspace context only)'

  const systemPrompt = buildSystemPrompt({
    workspaceName: tenant.name,
    workspaceId: tenant.id,
    publishProfile: tenant.publishProfile,
    connectorLabels,
    services,
    serviceContext,
  })

  // Cancel proposal
  if (cancelProposalId) {
    const cancelled = cancelPendingProposal(cancelProposalId, sessionId, auth.user.id)
    return NextResponse.json({
      reply: cancelled
        ? 'Cancelled. No partner action was executed.'
        : 'That proposal was already cleared or expired.',
      workspaceId,
      tenantId: workspaceId,
      services,
      sessionId,
      suggestions: promptSuggestionsForServices(services),
      pendingProposal: null,
    })
  }

  // Confirm proposal → execute writes
  if (confirmProposalId) {
    const proposal = getPendingProposal(confirmProposalId)
    if (
      !proposal ||
      proposal.sessionId !== sessionId ||
      proposal.userId !== auth.user.id ||
      proposal.workspaceId !== workspaceId
    ) {
      return NextResponse.json(
        { error: 'Proposal not found, expired, or not owned by this session' },
        { status: 404 },
      )
    }

    const consumed = consumePendingProposal(confirmProposalId)
    if (!consumed) {
      return NextResponse.json({ error: 'Proposal expired' }, { status: 410 })
    }

    const results = []
    for (const tool of consumed.tools) {
      const result = await executePartnerTool({
        bundle,
        name: tool.name,
        args: tool.args,
      })
      results.push({ name: tool.name, result })
    }

    const summary = await summarizeToolResults({
      userMessage: consumed.summary,
      history: history.filter((m) => m.role === 'user' || m.role === 'assistant'),
      systemPrompt,
      toolResults: results,
      accountUserId: auth.user.id,
      usageSurface: 'tenants',
    })

    if (!summary.ok) {
      return NextResponse.json({ error: summary.error, code: summary.code }, { status: 502 })
    }

    return NextResponse.json({
      reply: summary.text,
      workspaceId,
      tenantId: workspaceId,
      services,
      sessionId,
      suggestions: promptSuggestionsForServices(services),
      pendingProposal: null,
      toolResults: results,
    })
  }

  if (!message) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 })
  }

  const turn = classifyPartnerTurn({ message, services })
  if (turn.kind === 'off_topic') {
    return NextResponse.json({
      reply: PARTNER_OFF_TOPIC_REPLY,
      workspaceId,
      tenantId: workspaceId,
      services,
      sessionId,
      suggestions: promptSuggestionsForServices(services),
      pendingProposal: null,
    })
  }

  const scopedTools =
    turn.preferredTools.length === 0
      ? bundle.tools
      : bundle.tools.filter((t) =>
          turn.preferredTools.some(
            (name) => t.name === name || t.name.endsWith(`__${name}`),
          ),
        )
  const toolDecls = (scopedTools.length > 0 ? scopedTools : bundle.tools).map((t) => ({
    name: t.name,
    description: `${t.description} [${t.sideEffect}]`,
    parameters: t.parameters,
  }))

  const first = await generateReplyWithTools({
    userMessage: message,
    history: history.filter((m) => m.role === 'user' || m.role === 'assistant'),
    systemPrompt,
    tools: toolDecls,
    accountUserId: auth.user.id,
    usageSurface: 'tenants',
  })

  if (!first.ok) {
    return NextResponse.json({ error: first.error, code: first.code }, { status: 502 })
  }

  const requested = first.requestedTools
  if (requested.length === 0) {
    return NextResponse.json({
      reply: first.text,
      workspaceId,
      tenantId: workspaceId,
      services,
      sessionId,
      suggestions: promptSuggestionsForServices(services),
      pendingProposal: null,
    })
  }

  const reads: Array<{ name: string; args: Record<string, unknown> }> = []
  const writes: PendingProposalTool[] = []

  for (const call of requested) {
    const def = findToolDefinition(bundle, call.name)
    const sideEffect = def?.sideEffect ?? 'read'
    if (sideEffect === 'write') {
      writes.push({
        name: call.name,
        args: call.args,
        connectorId: def?.connectorId || '',
        connectorKind: def?.connectorKind || 'unknown',
        connectorLabel: def?.connectorLabel || def?.connectorKind || 'partner',
        description: def?.description || call.name,
      })
    } else {
      reads.push({ name: call.name, args: call.args })
    }
  }

  // If any writes are requested, propose them (after optionally running reads for context)
  if (writes.length > 0) {
    let readContextNote = ''
    if (reads.length > 0) {
      const readResults = await runReadTools(bundle, reads)
      readContextNote = `\n\nContext from read tools:\n${JSON.stringify(readResults, null, 2)}`
    }

    const proposal = createPendingProposal({
      sessionId,
      workspaceId,
      userId: auth.user.id,
      summary: message,
      tools: writes,
    })

    const writeSummary = writes
      .map(
        (w) =>
          `- **${w.connectorLabel}** \`${w.name}\`\n  ${w.description}\n  Args: \`${JSON.stringify(w.args)}\``,
      )
      .join('\n')

    const reply = [
      first.text || 'I can do that after you confirm.',
      '',
      '**Proposed partner actions** (not run yet):',
      writeSummary,
      '',
      'Confirm to execute, or cancel to abort.',
      readContextNote,
    ]
      .filter(Boolean)
      .join('\n')

    return NextResponse.json({
      reply,
      workspaceId,
      tenantId: workspaceId,
      services,
      sessionId,
      suggestions: promptSuggestionsForServices(services),
      pendingProposal: {
        id: proposal.id,
        summary: proposal.summary,
        tools: proposal.tools.map((t) => ({
          name: t.name,
          args: t.args,
          connectorKind: t.connectorKind,
          connectorLabel: t.connectorLabel,
          description: t.description,
        })),
      },
    })
  }

  // Reads only — auto execute and summarize
  const readResults = await runReadTools(bundle, reads)
  const summary = await summarizeToolResults({
    userMessage: message,
    history: history.filter((m) => m.role === 'user' || m.role === 'assistant'),
    systemPrompt,
    toolResults: readResults,
    accountUserId: auth.user.id,
    usageSurface: 'tenants',
  })

  if (!summary.ok) {
    // Fallback: return raw results if summarizer fails
    const fallback =
      first.text ||
      `Tool results:\n${JSON.stringify(readResults, null, 2)}`
    return NextResponse.json({
      reply: fallback,
      workspaceId,
      tenantId: workspaceId,
      services,
      sessionId,
      suggestions: promptSuggestionsForServices(services),
      pendingProposal: null,
      toolResults: readResults,
      warning: summary.error,
    })
  }

  return NextResponse.json({
    reply: summary.text,
    workspaceId,
    tenantId: workspaceId,
    services,
    sessionId,
    suggestions: promptSuggestionsForServices(services),
    pendingProposal: null,
    toolResults: readResults,
  })
}
