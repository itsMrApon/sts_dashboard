import { NextResponse } from 'next/server'
import { EMBED_DAILY_QUOTAS, EMBED_RATE_LIMITS } from '@/lib/embed/rateLimit'
import { embedOptions, guardEmbedRequest, jsonWithCors } from '@/lib/embed/embedRouteGuard'
import { generateRoomChatReply } from '@/lib/services/chatReply'
import { getBusinessByRoomName } from '@/lib/business/creatorBusiness'
import { getBusinessServices } from '@/lib/services/serviceConfig'
import { chatStyleInstruction } from '@/lib/services/persona'

type RouteContext = { params: Promise<{ roomName: string }> }

export async function OPTIONS(req: Request, routeContext: RouteContext) {
  const { roomName } = await routeContext.params
  return embedOptions(req, roomName)
}

/** Hosted chat page + legacy embed. The website SDK uses /api/sdk/v1/chat. */
export async function POST(req: Request, routeContext: RouteContext) {
  try {
    const { roomName } = await routeContext.params
    const body = await req.json()
    const message = typeof body?.message === 'string' ? body.message : ''
    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : ''

    if (!message || !sessionId || message.length > 4000 || sessionId.length > 128) {
      return NextResponse.json({ error: 'message and sessionId required' }, { status: 400 })
    }

    const guard = await guardEmbedRequest(req, roomName, {
      scope: 'chat',
      perSession: EMBED_RATE_LIMITS.chat,
      perIp: EMBED_RATE_LIMITS.chatIp,
      dailyQuota: EMBED_DAILY_QUOTAS.chat,
    })
    if (!guard.ok) return guard.response

    // A business room answers in the style set in Messages → Chat AI.
    const business = await getBusinessByRoomName(roomName)
    const style = business ? chatStyleInstruction((await getBusinessServices(business.workspaceId)).chat.config) : undefined
    const result = await generateRoomChatReply({ roomName, message, sessionId, extraInstruction: style })
    if (!result.ok) {
      return jsonWithCors({ error: result.error, code: result.code }, guard.corsHeaders, { status: result.status })
    }
    return jsonWithCors(
      {
        reply: result.reply,
        roomJoinLink: result.roomJoinLink,
        buyNowLink: result.buyNowLink,
        voiceAgentLinks: result.voiceAgentLinks,
        productLinks: result.productLinks,
        socialAccounts: result.socialAccounts,
      },
      guard.corsHeaders,
    )
  } catch (error) {
    console.error('[web-chat]', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
