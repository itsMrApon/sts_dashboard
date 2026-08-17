import { NextRequest, NextResponse } from 'next/server'
import { verifyMcpToken } from '@/lib/mcpAuth'
import { prismaClient } from '@/lib/prismaClient'
import { buildAgentContext } from '@/lib/messages/buildAgentContext'

type JsonRpcRequest = {
  jsonrpc: '2.0'
  id: string | number | null
  method: string
  params?: Record<string, unknown>
}

const allowedResources = [
  'core/compact',
  'industry/compact',
  'social/compact',
  'services/list',
  'pricing',
  'links',
] as const

const mapScope = {
  'core/compact': 'tenant.core.compact.read',
  'industry/compact': 'tenant.industry.compact.read',
  'social/compact': 'tenant.social.compact.read',
  'services/list': 'tenant.services.list.read',
  pricing: 'tenant.pricing.read',
  links: 'tenant.links.read',
} as const

const toError = (id: JsonRpcRequest['id'], code: number, message: string) => ({
  jsonrpc: '2.0' as const,
  id,
  error: { code, message },
})

export async function POST(request: NextRequest) {
  const body = (await request.json()) as JsonRpcRequest
  const id = body.id ?? null
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  const session = token ? verifyMcpToken(token) : null

  if (!session) {
    return NextResponse.json(toError(id, -32001, 'Unauthorized'), { status: 401 })
  }

  if (body.method === 'initialize') {
    return NextResponse.json({
      jsonrpc: '2.0',
      id,
      result: {
        serverInfo: { name: 'sts-ai-tenant-mcp', version: '1.0.0' },
        capabilities: { resources: {} },
      },
    })
  }

  if (body.method === 'resources/list') {
    return NextResponse.json({
      jsonrpc: '2.0',
      id,
      result: {
        resources: allowedResources.map((path) => ({
          uri: `mcp://tenant/${session.tenantId}/${path}`,
          name: path,
        })),
      },
    })
  }

  if (body.method === 'resources/read') {
    const uri = String(body.params?.uri || '')
    const prefix = `mcp://tenant/${session.tenantId}/`
    if (!uri.startsWith(prefix)) {
      return NextResponse.json(toError(id, -32602, 'Invalid resource uri'), { status: 400 })
    }
    const resourcePath = uri.slice(prefix.length) as (typeof allowedResources)[number]
    if (!allowedResources.includes(resourcePath)) {
      return NextResponse.json(toError(id, -32602, 'Unknown resource'), { status: 400 })
    }

    const requiredScope = mapScope[resourcePath]
    if (!session.scopes.includes(requiredScope)) {
      return NextResponse.json(toError(id, -32003, 'Forbidden scope'), { status: 403 })
    }

    const tenant = await prismaClient.workspace.findUnique({
      where: { id: session.tenantId },
      include: { publishProfile: true },
    })
    if (!tenant) {
      return NextResponse.json(toError(id, -32004, 'Tenant not found'), { status: 404 })
    }

    const compact = (tenant.compactProfileJson as Record<string, unknown>) || {}
    const payloadByPath: Record<(typeof allowedResources)[number], unknown> = {
      'core/compact': compact.core || null,
      'industry/compact': compact.industry || null,
      'social/compact': compact.social || null,
      'services/list': {
        tenantId: tenant.id,
        tenantName: tenant.name,
        vertical: tenant.contextVertical || null,
      },
      pricing: {
        cta: (compact.core as { cta?: unknown } | undefined)?.cta || null,
      },
      links: {
        stripeOrderUrl: null,
        webinarLinks: [],
        projectLinks: [],
        chatRoomName: tenant.webinarId || null,
      },
    }

    return NextResponse.json({
      jsonrpc: '2.0',
      id,
      result: {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(payloadByPath[resourcePath]),
          },
        ],
      },
    })
  }

  if (body.method === 'room/merged') {
    if (!session.scopes.includes('tenant.room.merged.read')) {
      return NextResponse.json(toError(id, -32003, 'Forbidden scope'), { status: 403 })
    }

    const requestedRoomName = String(body.params?.roomName || '')
    const tenant = await prismaClient.workspace.findUnique({
      where: { id: session.tenantId },
      include: { publishProfile: true },
    })
    if (!tenant) {
      return NextResponse.json(toError(id, -32004, 'Tenant not found'), { status: 404 })
    }

    const roomName = requestedRoomName || tenant.webinarId || ''
    if (!roomName) {
      return NextResponse.json(toError(id, -32602, 'roomName is required'), { status: 400 })
    }

    const channel = await prismaClient.messageChannel.findFirst({
      where: { roomName, workspaceId: session.tenantId },
      orderBy: { updatedAt: 'desc' },
      select: { roomName: true, webinarId: true, platform: true },
    })

    if (!channel) {
      return NextResponse.json(toError(id, -32004, 'Room not found for tenant'), { status: 404 })
    }

    const context = await buildAgentContext(channel.roomName)
    const compact = (tenant.compactProfileJson as Record<string, unknown>) || {}
    const webinar = channel.webinarId
      ? await prismaClient.webinar.findUnique({
          where: { id: channel.webinarId },
          select: {
            id: true,
            title: true,
            kind: true,
            ctaType: true,
            ctaUrl: true,
            ctaLabel: true,
            linkVariants: true,
          },
        })
      : null

    return NextResponse.json({
      jsonrpc: '2.0',
      id,
      result: {
        tenant: {
          id: tenant.id,
          name: tenant.name,
          businessName: tenant.publishProfile?.name || null,
          contextVersion: tenant.contextVersion || null,
          compactTokenEstimate: tenant.compactTokenEstimate || 0,
          compact,
        },
        room: {
          roomName: channel.roomName,
          platform: channel.platform,
          agentName: context.agentName,
          firstMessage: context.firstMessage,
          roomJoinLink: context.roomJoinLink,
          buyNowLink: context.buyNowLink,
        },
        aiPrompt: {
          systemInstruction: context.systemInstruction,
        },
        projectCta: webinar
          ? {
              webinarId: webinar.id,
              title: webinar.title,
              kind: webinar.kind,
              ctaType: webinar.ctaType,
              ctaUrl: webinar.ctaUrl,
              ctaLabel: webinar.ctaLabel,
              linkVariants: webinar.linkVariants,
            }
          : null,
      },
    })
  }

  return NextResponse.json(toError(id, -32601, 'Method not found'), { status: 404 })
}

