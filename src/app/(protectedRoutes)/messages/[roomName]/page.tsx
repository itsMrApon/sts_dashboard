import React from 'react'
import { notFound, redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import PageHeader from '@/components/ReusableComponent/PageHeader'
import { ChevronLeft, MessageCircle, Sparkles, Briefcase, Bot, Package, ExternalLink } from 'lucide-react'
import { onAuthenticateUser } from '@/actions/auth'
import { prismaClient } from '@/lib/prismaClient'
import { verifyRoomOwnership } from '@/lib/messages/verifyRoomOwnership'
import { Platform, ChannelStatus, type MessageChannel } from '@prisma/client'
import { PlatformCard } from '@/components/messages/PlatformCard'
import { TelegramCard } from './_components/TelegramCard'
import { DiscordCard } from './_components/DiscordCard'
import { SlackCard } from './_components/SlackCard'
import { WebChatCard } from './_components/WebChatCard'
import { RoomTenantPicker } from './_components/RoomTenantPicker'
import { RoomPageChrome } from './_components/RoomPageChrome'
import Link from 'next/link'
import { startPerf, timeAsync } from '@/lib/dev/perf'

type RoomBusinessData = {
  id: string
  name: string
  agents: {
    isPrimary: boolean
    agent: { id: string; name: string; roomName: string }
  }[]
  products: {
    isPrimary: boolean
    webinar: { id: string; title: string; kind: 'PROJECT' | 'PRODUCT'; description: string | null }
  }[]
}

type Props = {
  params: Promise<{ roomName: string }>
}

type RoomPageData = {
  business: RoomBusinessData | null
  channels: MessageChannel[]
  businessProfileOptions: Array<{
    businessId: string
    name: string
    pitchTenantId: string | null
  }>
  legacyPitchTenant: { id: string; name: string } | null
}

const getRoomPageDataCached = unstable_cache(
  async (userId: string, roomName: string, agentId: string | null): Promise<RoomPageData> => {
    let business: RoomBusinessData | null = null
    let resolvedBusinessId: string | null = null

    if (agentId) {
      const businessLink = await prismaClient.businessAgent.findFirst({
        where: { agentId },
        select: { businessId: true },
      })
      resolvedBusinessId = businessLink?.businessId ?? null
    }

    if (!resolvedBusinessId) {
      const channelRow = await prismaClient.messageChannel.findFirst({
        where: {
          roomName,
          businessId: { not: null },
          business: { userId },
        },
        select: { businessId: true },
      })
      resolvedBusinessId = channelRow?.businessId ?? null
    }

    if (resolvedBusinessId) {
      const [businessRow, businessAgentRows, businessProductRows] = await Promise.all([
        prismaClient.business.findFirst({
          where: { id: resolvedBusinessId, userId },
          select: { id: true, name: true },
        }),
        prismaClient.businessAgent.findMany({
          where: { businessId: resolvedBusinessId },
          orderBy: { isPrimary: 'desc' },
          select: {
            isPrimary: true,
            agentId: true,
          },
        }),
        prismaClient.businessProduct.findMany({
          where: { businessId: resolvedBusinessId },
          orderBy: { isPrimary: 'desc' },
          select: {
            isPrimary: true,
            webinarId: true,
          },
        }),
      ])

      if (businessRow) {
        const [agentMapRows, webinarMapRows] = await Promise.all([
          prismaClient.liveKitAgent.findMany({
            where: { id: { in: businessAgentRows.map((row) => row.agentId) } },
            select: { id: true, name: true, roomName: true },
          }),
          prismaClient.webinar.findMany({
            where: { id: { in: businessProductRows.map((row) => row.webinarId) } },
            select: { id: true, title: true, kind: true, description: true },
          }),
        ])

        const agentById = new Map(agentMapRows.map((row) => [row.id, row]))
        const webinarById = new Map(webinarMapRows.map((row) => [row.id, row]))

        business = {
          id: businessRow.id,
          name: businessRow.name,
          agents: businessAgentRows
            .map((row) => {
              const agent = agentById.get(row.agentId)
              if (!agent) return null
              return {
                isPrimary: row.isPrimary,
                agent,
              }
            })
            .filter((row): row is NonNullable<typeof row> => Boolean(row)),
          products: businessProductRows
            .map((row) => {
              const webinar = webinarById.get(row.webinarId)
              if (!webinar) return null
              return {
                isPrimary: row.isPrimary,
                webinar,
              }
            })
            .filter((row): row is NonNullable<typeof row> => Boolean(row)),
        }
      }
    }

    const [channels, businessProfileRows] = await Promise.all([
      prismaClient.messageChannel.findMany({
        where: { roomName },
      }),
      (
        prismaClient.business as unknown as {
          findMany: (
            args: unknown,
          ) => Promise<Array<{ id: string; name: string; tenants: Array<{ id: string }> }>>
        }
      ).findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          tenants: {
            orderBy: { updatedAt: 'desc' },
            take: 1,
            select: { id: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const activeChannel = channels.find((c) => c.status === ChannelStatus.ACTIVE)
    const currentTenantId =
      (activeChannel as unknown as { tenantId?: string } | undefined)?.tenantId || null

    const businessProfileOptions = businessProfileRows.map((b) => ({
      businessId: b.id,
      name: b.name,
      pitchTenantId: b.tenants[0]?.id ?? null,
    }))

    let legacyPitchTenant: { id: string; name: string } | null = null
    if (currentTenantId) {
      const pitchRow = await (
        prismaClient as unknown as {
          tenant: {
            findFirst: (args: unknown) => Promise<{ id: string; name: string; businessId: string | null } | null>
          }
        }
      ).tenant.findFirst({
        where: { id: currentTenantId, userId },
        select: { id: true, name: true, businessId: true },
      })
      if (pitchRow && !pitchRow.businessId) {
        legacyPitchTenant = { id: pitchRow.id, name: pitchRow.name }
      }
    }

    return {
      business,
      channels,
      businessProfileOptions,
      legacyPitchTenant,
    }
  },
  ['messages-room-page-data'],
  { revalidate: 10 },
)

const Page = async ({ params }: Props) => {
  const timer = startPerf('route.messages.room')
  const { roomName: rawRoomName } = await params
  let roomName = rawRoomName.trim()
  try {
    roomName = decodeURIComponent(roomName).trim()
  } catch {
    /* invalid escape — use raw segment */
  }
  if (!roomName) notFound()

  const auth = await timeAsync('route.messages.room.onAuthenticateUser', () =>
    onAuthenticateUser(),
  )
  if (!auth.user) redirect('/sign-in')

  const ownership = await timeAsync('route.messages.room.verifyRoomOwnership', () =>
    verifyRoomOwnership(roomName, { id: auth.user.id, clerkId: auth.user.clerkId }),
  )
  if (!ownership.ok) {
    if (ownership.reason === 'UNAUTHENTICATED') redirect('/sign-in')
    notFound()
  }

  const agent = ownership.agent
  const roomData = await timeAsync('route.messages.room.getRoomPageDataCached', () =>
    getRoomPageDataCached(auth.user.id, roomName, agent?.id ?? null),
  )
  const { business, channels, businessProfileOptions, legacyPitchTenant } = roomData

  const telegram = channels.find((c) => c.platform === Platform.TELEGRAM)
  const discord = channels.find((c) => c.platform === Platform.DISCORD)
  const slack = channels.find((c) => c.platform === Platform.SLACK)

  const activeChannel = channels.find((c) => c.status === ChannelStatus.ACTIVE)
  const currentTenantId =
    (activeChannel as unknown as { tenantId?: string | null } | undefined)?.tenantId ?? null

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''

  const statusFor = (record: typeof telegram) => {
    if (!record) return 'inactive' as const
    if (record.status === ChannelStatus.ERROR) return 'error' as const
    if (record.status === ChannelStatus.ACTIVE) return 'active' as const
    return 'inactive' as const
  }

  const roomNameEncoded = encodeURIComponent(roomName)

  const rendered = (
    <div className="relative w-full flex flex-col gap-8 pb-28 pt-2 sm:pt-3">
      <RoomPageChrome roomNameEncoded={roomNameEncoded} />
      <PageHeader
        leftIcon={<ChevronLeft className="w-3 h-3" />}
        mainIcon={<MessageCircle className="w-12 h-12" />}
        rightIcon={<Sparkles className="w-4 h-4" />}
        heading={
          business
            ? `${business.name} · Messaging`
            : `Messaging · ${agent?.name ?? roomName}`
        }
        placeholder="Search conversations…"
      />

      <p className="text-sm text-muted-foreground -mt-4">
        {business
          ? 'Linked projects and agents feed the AI. Connect Telegram, Discord, Slack, or web chat below.'
          : 'Connect messaging channels. Link a business profile below if you want pitch copy in context.'}
      </p>

      {!agent && (
        <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
          No AI agent record exists for this room (it may have been removed). Channel settings below
          still work. To restore chat/voice, create an agent in{' '}
          <Link href="/ai-agents" className="underline font-medium">
            AI Agents
          </Link>{' '}
          and link it to this business.
        </div>
      )}

      {/* Business Overview */}
      {business && (
        <div className="rounded-2xl border border-border/70 bg-card/70 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Briefcase className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">{business.name}</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Linked Agents */}
            <div className="rounded-xl border border-border/70 bg-background/30 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Bot className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">AI Agents</h3>
              </div>
              <div className="flex flex-col gap-2">
                {business.agents.map((ba) => (
                  <div
                    key={ba.agent.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="truncate">{ba.agent.name}</span>
                      {ba.isPrimary && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                          Primary
                        </span>
                      )}
                    </div>
                    <a
                      href={`${appUrl}/chat/${ba.agent.roomName}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Chat
                    </a>
                  </div>
                ))}
              </div>
            </div>

            {/* Linked Products */}
            <div className="rounded-xl border border-border/70 bg-background/30 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Package className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">Products</h3>
              </div>
              {business.products.length === 0 ? (
                <p className="text-xs text-muted-foreground">No products linked yet.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {business.products.map((bp) => {
                    const url =
                      bp.webinar.kind === 'PROJECT'
                        ? `${appUrl}/live-project/${bp.webinar.id}`
                        : `${appUrl}/live-product/${bp.webinar.id}`
                    return (
                      <div
                        key={bp.webinar.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span className="truncate">{bp.webinar.title}</span>
                          {bp.isPrimary && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">
                              Featured
                            </span>
                          )}
                        </div>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View
                        </a>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-border/60 bg-background/30 p-4">
            <RoomTenantPicker
              roomName={roomName}
              currentPitchTenantId={currentTenantId}
              legacyPitchTenant={legacyPitchTenant}
              profiles={businessProfileOptions}
              variant="withBusinessProducts"
            />
          </div>
        </div>
      )}

      {!business && (
        <div className="rounded-2xl border border-border/70 bg-card/70 p-5">
          <RoomTenantPicker
            roomName={roomName}
            currentPitchTenantId={currentTenantId}
            legacyPitchTenant={legacyPitchTenant}
            profiles={businessProfileOptions}
            variant="standalone"
          />
        </div>
      )}

      {/* Channel cards */}
      <section
        id="messaging-setup"
        className="grid scroll-mt-28 gap-6 md:grid-cols-2"
      >
        <PlatformCard
          title="Web Chat"
          icon={<span className="text-sm font-semibold text-cyan-500">WC</span>}
          status="active"
        >
          <WebChatCard roomName={roomName} />
        </PlatformCard>

        <PlatformCard
          title="Telegram"
          icon={<span className="text-sm font-semibold text-sky-500">TG</span>}
          status={statusFor(telegram)}
        >
          <TelegramCard roomName={roomName} channel={telegram || null} />
        </PlatformCard>

        <PlatformCard
          title="Discord"
          icon={<span className="text-sm font-semibold text-indigo-500">DC</span>}
          status={statusFor(discord)}
        >
          <DiscordCard roomName={roomName} channel={discord || null} />
        </PlatformCard>

        <PlatformCard
          title="Slack"
          icon={<span className="text-sm font-semibold text-amber-500">SL</span>}
          status={statusFor(slack)}
        >
          <SlackCard roomName={roomName} channel={slack || null} />
        </PlatformCard>
      </section>

      <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
        <p className="text-sm text-muted-foreground">
          Looking to connect WhatsApp, Email, Instagram, or other outreach channels?
          Set them up in your{' '}
          <Link href="/tenants/business-profile" className="underline text-primary font-medium">
            Business Profile
          </Link>{' '}
          under Tenants → Business profile. Your AI will automatically know about connected social accounts for that business.
        </p>
      </div>
    </div>
  )
  timer.end({
    roomName,
    hasBusiness: Boolean(business),
    channelCount: channels.length,
  })
  return rendered
}

export default Page
