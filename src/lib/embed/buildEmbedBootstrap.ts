import { prismaClient } from '@/lib/prismaClient'
import { buildAgentContext } from '@/lib/messages/buildAgentContext'

export type EmbedBootstrapPayload = {
  roomName: string
  agentName: string
  businessName: string
  firstMessage: string
  socialAccounts: { platform: string; label: string; url?: string }[]
  ctaLinks: {
    roomJoinLink: string | null
    buyNowLink: string | null
    productLinks: { name: string; url: string; buyUrl?: string }[]
    voiceAgentLinks: { name: string; url: string }[]
  }
  tabs: {
    chat: boolean
    voice: boolean
    mobile: boolean
  }
  api: {
    chat: string
    voice: string
    mobile: string
    bootstrap: string
  }
}

export async function buildEmbedBootstrap(roomName: string): Promise<EmbedBootstrapPayload | null> {
  const agent = await prismaClient.liveKitAgent.findUnique({
    where: { roomName },
  })
  if (!agent) return null

  const context = await buildAgentContext(roomName, {
    preloadedAgent: agent,
    mode: 'embedBootstrap',
  })
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
  const encoded = encodeURIComponent(roomName)

  return {
    roomName,
    agentName: agent.name,
    businessName: context.businessName ?? agent.name,
    firstMessage: agent.firstMessage || `Hi! I'm ${agent.name}. How can I help you today?`,
    socialAccounts: context.socialAccounts,
    ctaLinks: {
      roomJoinLink: context.roomJoinLink,
      buyNowLink: context.buyNowLink,
      productLinks: context.productLinks,
      voiceAgentLinks: context.voiceAgentLinks,
    },
    tabs: {
      chat: true,
      voice: true,
      mobile: true,
    },
    api: {
      chat: `${appUrl}/api/chat/${encoded}`,
      voice: `${appUrl}/api/livekit/connection-details`,
      mobile: `${appUrl}/api/chat/${encoded}/mobile-callback`,
      bootstrap: `${appUrl}/api/embed/v1/rooms/${encoded}/bootstrap`,
    },
  }
}
