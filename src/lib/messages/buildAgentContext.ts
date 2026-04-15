import type { LiveKitAgent } from '@prisma/client'
import { prismaClient } from '@/lib/prismaClient'
import { startPerf, timeAsync } from '@/lib/dev/perf'

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

export async function buildAgentContext(
  roomName: string,
  options?: { preloadedAgent?: LiveKitAgent | null; mode?: 'full' | 'homePreview' },
): Promise<AgentContext> {
  const mode = options?.mode ?? 'full'
  const timer = startPerf('messages.buildAgentContext', { roomName, mode })
  const agent =
    options?.preloadedAgent !== undefined
      ? options.preloadedAgent
      : await timeAsync('messages.buildAgentContext.liveKitAgent.findUnique', () =>
          prismaClient.liveKitAgent.findUnique({
            where: { roomName },
            ...(mode === 'homePreview'
              ? { select: { id: true, name: true, firstMessage: true, roomName: true } }
              : {}),
          }),
        )

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''

  const businessLinkInclude = {
    business: {
      include: {
        agents: {
          include: {
            agent: { select: { id: true, name: true, roomName: true } },
          },
        },
        products: {
          include: {
            webinar: {
              select: {
                id: true,
                title: true,
                description: true,
                kind: true,
                ctaType: true,
                ctaUrl: true,
                ctaLabel: true,
                couponCode: true,
                couponEnabled: true,
              },
            },
          },
        },
        user: { select: { id: true } },
      },
    },
  } as const

  const businessLinkSelectForPreview = {
    business: {
      select: {
        id: true,
        name: true,
        user: { select: { id: true } },
      },
    },
  } as const

  const [businessLink, channel] = await Promise.all([
    agent
      ? timeAsync('messages.buildAgentContext.businessAgent.findFirst', () =>
          prismaClient.businessAgent.findFirst({
            where: { agentId: agent.id },
            ...(mode === 'homePreview'
              ? { select: businessLinkSelectForPreview }
              : { include: businessLinkInclude }),
          }),
        )
      : Promise.resolve(null),
    mode === 'homePreview'
      ? Promise.resolve(null)
      : timeAsync('messages.buildAgentContext.messageChannel.findFirst', () =>
          prismaClient.messageChannel.findFirst({
            where: { roomName, status: 'ACTIVE' },
          }),
        ),
  ])

  const business = businessLink?.business || null

  const [outreach, tenant] = await Promise.all([
    business?.user?.id
      ? timeAsync('messages.buildAgentContext.outreachChannel.findMany', () =>
          prismaClient.outreachChannel.findMany({
            where: {
              userId: business.user.id,
              status: 'ACTIVE',
              businessId: business.id,
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
    channel?.tenantId
      ? timeAsync('messages.buildAgentContext.tenant.findUnique', () =>
          prismaClient.tenant.findUnique({
            where: { id: channel.tenantId },
            select: { name: true, pitchMessage: true, videoUrl: true },
          }),
        )
      : Promise.resolve(null),
  ])

  const socialAccounts = outreach.map((o) => ({
    platform: o.platform,
    label: o.accountLabel,
    url: o.pageUrl || undefined,
  }))

  let roomJoinLink: string | null = null
  let buyNowLink: string | null = null
  const voiceAgentLinks: { name: string; url: string }[] = []
  const productLinks: { name: string; url: string; buyUrl?: string }[] = []

  if (business && mode === 'full') {
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
      const url =
        w.kind === 'PROJECT'
          ? `${appUrl}/live-project/${w.id}`
          : `${appUrl}/live-product/${w.id}`

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

  if (mode === 'full' && !roomJoinLink && channel?.webinarId) {
    const webinar = await timeAsync('messages.buildAgentContext.webinar.findUnique', () =>
      prismaClient.webinar.findUnique({
        where: { id: channel.webinarId },
        select: { id: true, kind: true, ctaType: true, ctaUrl: true },
      }),
    )
    if (webinar) {
      roomJoinLink =
        webinar.kind === 'PROJECT'
          ? `${appUrl}/live-project/${webinar.id}`
          : `${appUrl}/live-product/${webinar.id}`
      if (webinar.ctaType === 'BUY_NOW' && webinar.ctaUrl) {
        buyNowLink = webinar.ctaUrl
      }
    }
  }

  const parts: string[] = []

  if (mode === 'full' && agent?.systemPrompt) {
    parts.push(agent.systemPrompt)
  }

  if (mode === 'full' && business && business.products.length > 0) {
    const productSections = business.products.map((bp) => {
      const w = bp.webinar
      const url =
        w.kind === 'PROJECT'
          ? `${appUrl}/live-project/${w.id}`
          : `${appUrl}/live-product/${w.id}`
      const lines = [
        `- **${w.title}**${bp.isPrimary ? ' (Featured)' : ''}`,
        w.description ? `  ${w.description}` : '',
        `  Link: ${url}`,
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

  if (mode === 'full' && tenant?.pitchMessage) {
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
    agentName: agent?.name || null,
    firstMessage: agent?.firstMessage || null,
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
