import type { LiveKitAgent } from '@prisma/client'
import { prismaClient } from '@/lib/prismaClient'
import { startPerf, timeAsync } from '@/lib/dev/perf'
import { loadApprovedAnswers } from '@/lib/questions/questionGroups'
import { enabledModes, primaryOfferLink } from '@/lib/offers/offerLinks'
import {
  WEBINAR_STATUS_LABEL,
  formatOfferPrice,
  isWebinarOver,
  summarizeOfferPrice,
} from '@/lib/offers/offerSummary'

export type AgentContext = {
  systemInstruction: string
  roomJoinLink: string | null
  buyNowLink: string | null
  businessName: string | null
  agentName: string | null
  firstMessage: string | null
  voiceAgentLinks: { name: string; url: string }[]
  productLinks: { name: string; url: string; buyUrl?: string }[]
  socialAccounts: { platform: string; label: string; url?: string }[]
}

type TenantCompactProfile = {
  vertical?: string
  businessName?: string
  core?: {
    audience?: string
    valueProposition?: string
    tone?: string[]
    complianceRules?: string[]
    cta?: { bookCall?: string; orderNow?: string }
  }
  industry?: {
    summary?: string
    deliverables?: string[]
    coverageTypes?: string[]
    filingTypes?: string[]
    jurisdiction?: string
    shippingPolicy?: string
    returnPolicy?: string
    sla?: string
  }
  social?: {
    websiteUrl?: string
    channels?: Array<{ platform?: string; label?: string; url?: string }>
  }
}

/** The offer's link for buyers, from its ways to order (webinars: the Live link when Live is on). */
function publicOfferUrl(
  appUrl: string,
  webinar: Parameters<typeof primaryOfferLink>[0] & { orderModes: Parameters<typeof enabledModes>[0] },
): string | null {
  return primaryOfferLink(webinar, enabledModes(webinar.orderModes), appUrl)?.url ?? null
}

/** "Tue, Nov 24, 2026, 10:00 AM UTC": the creator's timezone isn't stored, so say UTC explicitly. */
function formatWebinarStart(startTime: Date): string {
  return `${new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(startTime)} UTC`
}

export async function buildAgentContext(
  roomName: string,
  options?: {
    preloadedAgent?: LiveKitAgent | null
    mode?: 'full' | 'homePreview' | 'embedBootstrap'
    /** The service's own assistant (Services → Chat AI / Voice AI): its prompt, name and first
     *  message replace the room agent's. Business details still come from the room's business. */
    persona?: { name: string; systemPrompt: string | null; firstMessage: string | null } | null
    /** The project this chat is about (offer chats), so that project's answers come first. */
    projectId?: string | null
  },
): Promise<AgentContext> {
  const mode = options?.mode ?? 'full'
  const timer = startPerf('messages.buildAgentContext', { roomName, mode })
  const agent =
    options?.preloadedAgent !== undefined
      ? options.preloadedAgent
      : await timeAsync('messages.buildAgentContext.liveKitAgent.findUnique', () =>
          prismaClient.liveKitAgent.findUnique({ where: { roomName } }),
        )

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''

  const businessLinkInclude = {
    publishProfile: {
      include: {
        agents: {
          include: {
            agent: { select: { id: true, name: true, roomName: true } },
          },
        },
        products: {
          // Deleted offers are never promoted; ended webinars are dropped below.
          where: { webinar: { deletedAt: null } },
          include: {
            webinar: {
              select: {
                id: true,
                slug: true,
                title: true,
                description: true,
                kind: true,
                ctaType: true,
                ctaUrl: true,
                ctaLabel: true,
                couponCode: true,
                couponEnabled: true,
                startTime: true,
                webinarStatus: true,
                orderModes: { select: { kind: true, enabled: true } },
                prices: {
                  where: { active: true },
                  select: { kind: true, amountCents: true, currency: true, isDefault: true, active: true },
                },
              },
            },
          },
        },
        user: { select: { id: true } },
      },
    },
  } as const

  const [businessLink, channel] = await Promise.all([
    agent
      ? timeAsync('messages.buildAgentContext.businessAgent.findFirst', () =>
          prismaClient.publishAgent.findFirst({
            where: { agentId: agent.id },
            include: businessLinkInclude,
          }),
        )
      : Promise.resolve(null),
    mode === 'homePreview' || mode === 'embedBootstrap'
      ? Promise.resolve(null)
      : timeAsync('messages.buildAgentContext.messageChannel.findFirst', () =>
          prismaClient.messageChannel.findFirst({
            where: { roomName, status: 'ACTIVE' },
          }),
        ),
  ])

  const linkedBusiness = businessLink?.publishProfile || null
  // Only offers a buyer can act on: not ended, and with at least one way to order turned on.
  const business = linkedBusiness
    ? {
        ...linkedBusiness,
        products: linkedBusiness.products.filter(
          (bp) =>
            !(bp.webinar.kind === 'PROJECT' && isWebinarOver(bp.webinar.webinarStatus)) &&
            publicOfferUrl(appUrl, bp.webinar) !== null,
        ),
      }
    : null
  const workspaceId = channel?.workspaceId ?? null
  const webinarId = channel?.webinarId ?? null

  const [outreach, tenant, tenantCompactRow] = await Promise.all([
    business?.user?.id
      ? timeAsync('messages.buildAgentContext.outreachChannel.findMany', () =>
          prismaClient.outreachChannel.findMany({
            where: {
              userId: business.user.id,
              status: 'ACTIVE',
              publishProfileId: business.id,
            },
            select: { platform: true, accountLabel: true, pageUrl: true },
          }),
        )
      : Promise.resolve(
          [] as {
            platform: string
            accountLabel: string
            pageUrl: string | null
          }[],
        ),
    workspaceId
      ? timeAsync('messages.buildAgentContext.workspace.findUnique', () =>
          prismaClient.workspace.findUnique({
            where: { id: workspaceId },
            select: { name: true, pitchMessage: true, videoUrl: true },
          }),
        )
      : Promise.resolve(null),
    workspaceId
      ? timeAsync('messages.buildAgentContext.workspace.compact.raw', async () => {
          const rows = await prismaClient.$queryRaw<
            Array<{
              contextStatus: string | null
              compactProfileJson: unknown
              compactTokenEstimate: number | null
            }>
          >`SELECT "contextStatus", "compactProfileJson", "compactTokenEstimate" FROM "Tenant" WHERE "id" = ${workspaceId} LIMIT 1`
          return rows[0] || null
        })
      : Promise.resolve(null),
  ])

  const socialAccounts = outreach.map((o) => ({
    platform: o.platform,
    label: o.accountLabel || 'Account',
    url: o.pageUrl || undefined,
  }))

  let roomJoinLink: string | null = null
  let buyNowLink: string | null = null
  const voiceAgentLinks: { name: string; url: string }[] = []
  const productLinks: { name: string; url: string; buyUrl?: string }[] = []

  if (business && (mode === 'full' || mode === 'embedBootstrap')) {
    for (const ba of business.agents) {
      if (ba.agent.roomName !== roomName) {
        voiceAgentLinks.push({
          name: ba.agent.name,
          url: `${appUrl}/chat/${ba.agent.roomName}`,
        })
      }
    }

    for (const bp of business.products) {
      const w = bp.webinar
      const url = publicOfferUrl(appUrl, w)
      if (!url) continue

      productLinks.push({
        name: w.title,
        url,
        buyUrl: w.ctaType === 'BUY_NOW' && w.ctaUrl ? w.ctaUrl : undefined,
      })

      if (bp.isPrimary) {
        roomJoinLink = url
        if (w.ctaType === 'BUY_NOW' && w.ctaUrl) {
          buyNowLink = w.ctaUrl
        }
      }
    }
  }

  if (mode === 'full' && !roomJoinLink && webinarId) {
    const webinar = await timeAsync('messages.buildAgentContext.webinar.findUnique', () =>
      prismaClient.webinar.findFirst({
        where: { id: webinarId, deletedAt: null },
        select: {
          id: true,
          slug: true,
          kind: true,
          ctaType: true,
          ctaUrl: true,
          orderModes: { select: { kind: true, enabled: true } },
        },
      }),
    )
    if (webinar) {
      roomJoinLink = publicOfferUrl(appUrl, webinar)
      if (webinar.ctaType === 'BUY_NOW' && webinar.ctaUrl) {
        buyNowLink = webinar.ctaUrl
      }
    }
  }

  const parts: string[] = []

  const persona = options?.persona ?? null
  const personaPrompt = persona ? persona.systemPrompt : agent?.systemPrompt
  if (mode === 'full' && personaPrompt) {
    parts.push(personaPrompt)
  }

  if (mode === 'full' && business && business.products.length > 0) {
    const productSections = business.products.map((bp) => {
      const w = bp.webinar
      const url = publicOfferUrl(appUrl, w)
      const price = summarizeOfferPrice(w.prices)
      const lines = [
        `- **${w.title}**${w.kind === 'PROJECT' ? ' (Webinar)' : ''}${bp.isPrimary ? ' (Featured)' : ''}`,
        w.description ? `  ${w.description}` : '',
        w.kind === 'PROJECT'
          ? w.webinarStatus === 'LIVE'
            ? '  When: live now'
            : `  When: ${formatWebinarStart(w.startTime)} (${WEBINAR_STATUS_LABEL[w.webinarStatus].toLowerCase()})`
          : '',
        price ? `  Price: ${formatOfferPrice(price)}` : '',
        url ? `  Link: ${url}` : '',
        w.ctaType === 'BUY_NOW' && w.ctaUrl ? `  Buy: ${w.ctaUrl}` : '',
        w.couponEnabled && w.couponCode ? `  Coupon: ${w.couponCode}` : '',
      ]
      return lines.filter(Boolean).join('\n')
    })
    parts.push(['## Products & Offers', ...productSections].join('\n'))
  }

  if (mode === 'full' && voiceAgentLinks.length > 0) {
    const agentLines = voiceAgentLinks.map(
      (a) => `- ${a.name}: ${a.url}`,
    )
    parts.push(
      [
        '## Other AI Assistants',
        'The user can talk to these other AI agents about specific topics:',
        ...agentLines,
      ].join('\n'),
    )
  }

  if (socialAccounts.length > 0) {
    const socialLines = socialAccounts.map((s) => {
      const readable = s.platform.replace(/_/g, ' ').replace(/DM$/i, '').trim()
      return s.url ? `- ${readable}: ${s.label} — ${s.url}` : `- ${readable}: ${s.label}`
    })
    parts.push(['## Business Social Accounts', ...socialLines].join('\n'))
  }

  if (mode === 'full' && (roomJoinLink || buyNowLink)) {
    parts.push(
      [
        '## Important Links',
        roomJoinLink ? `Join room / learn more: ${roomJoinLink}` : '',
        buyNowLink ? `Buy now: ${buyNowLink}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    )
  }

  if (mode === 'full' && tenant) {
    const compact = (tenantCompactRow?.compactProfileJson as TenantCompactProfile | null) || null
    const hasPublishedCompact = tenantCompactRow?.contextStatus === 'PUBLISHED' && compact

    if (hasPublishedCompact) {
      const compactSections: string[] = []
      const core = compact.core
      const industry = compact.industry
      const social = compact.social

      if (compact.businessName || compact.vertical) {
        compactSections.push(
          [
            '## Tenant MCP Compact Context',
            compact.businessName ? `Business: ${compact.businessName}` : '',
            compact.vertical ? `Vertical: ${compact.vertical}` : '',
          ]
            .filter(Boolean)
            .join('\n'),
        )
      }

      if (core) {
        compactSections.push(
          [
            '### Core',
            core.audience ? `Audience: ${core.audience}` : '',
            core.valueProposition ? `Value proposition: ${core.valueProposition}` : '',
            core.tone?.length ? `Tone: ${core.tone.join(', ')}` : '',
            core.complianceRules?.length ? `Compliance: ${core.complianceRules.join(' | ')}` : '',
          ]
            .filter(Boolean)
            .join('\n'),
        )
      }

      if (industry) {
        const highlights = [
          ...(industry.deliverables || []),
          ...(industry.coverageTypes || []),
          ...(industry.filingTypes || []),
        ].slice(0, 8)
        compactSections.push(
          [
            '### Industry',
            industry.summary ? industry.summary : '',
            industry.jurisdiction ? `Jurisdiction: ${industry.jurisdiction}` : '',
            industry.shippingPolicy ? `Shipping: ${industry.shippingPolicy}` : '',
            industry.returnPolicy ? `Returns: ${industry.returnPolicy}` : '',
            industry.sla ? `SLA: ${industry.sla}` : '',
            highlights.length ? `Highlights: ${highlights.join(' | ')}` : '',
          ]
            .filter(Boolean)
            .join('\n'),
        )
      }

      if (social?.channels?.length) {
        const channelLines = social.channels
          .slice(0, 6)
          .map((entry) => {
            const platform = (entry.platform || 'Channel').replace(/_/g, ' ')
            const label = entry.label ? ` ${entry.label}` : ''
            return entry.url ? `- ${platform}:${label} — ${entry.url}` : `- ${platform}:${label}`.trim()
          })
        compactSections.push(['### Channels', ...channelLines].join('\n'))
      }

      if (compactSections.length > 0) {
        compactSections.push(
          `Compact token estimate: ${tenantCompactRow?.compactTokenEstimate || 0}. Prefer this compact context over long freeform text.`,
        )
        parts.push(compactSections.join('\n\n'))
      }
    } else if (tenant.pitchMessage) {
      parts.push(
        [
          '## Tenant context',
          tenant.pitchMessage,
          tenant.videoUrl ? `Pitch video: ${tenant.videoUrl}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      )
    }
  }

  // The creator's own answers to questions customers keep asking (Projects → Questions).
  if (mode === 'full' && business?.user?.id) {
    const answers = await loadApprovedAnswers(business.user.id, options?.projectId ?? webinarId)
    if (answers.length > 0) {
      parts.push(
        [
          '## Answers from the business',
          'When a visitor asks one of these, answer with this content in your own words and in the visitor’s language. These come from the owner, so prefer them over your own guesses.',
          ...answers.map((item) => `Q: ${item.question}\nA: ${item.answer}`),
        ].join('\n'),
      )
    }
  }

  if (mode === 'full') {
    parts.push(
      [
        '## Conversation Rules',
        '- Keep replies concise — 1 to 3 sentences unless asked for more',
        '- When relevant share product links, buy now links, or voice agent links naturally',
        '- If asked about social accounts (Instagram, YouTube, etc.), share the business links',
        '- If the user wants to talk about a specific product, suggest the relevant AI agent or product page',
        '- Do not use excessive markdown or bullet points',
        '- Sound human, warm, and confident',
        '- If asked about pricing, share the product details above',
      ].join('\n'),
    )
  }

  const result = {
    systemInstruction: parts.join('\n\n').trim(),
    roomJoinLink,
    buyNowLink,
    businessName: business?.name ?? null,
    agentName: (persona ? persona.name : agent?.name) || null,
    firstMessage: (persona ? persona.firstMessage : agent?.firstMessage) || null,
    voiceAgentLinks,
    productLinks,
    socialAccounts,
  }
  timer.end({
    hasBusiness: Boolean(business),
    hasTenant: Boolean(tenant),
  })
  return result
}
