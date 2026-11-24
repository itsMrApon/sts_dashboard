import { NextResponse } from 'next/server'
import { getBusinessByRoomName } from '@/lib/business/creatorBusiness'
import { embedOptions, guardEmbedRequest, jsonWithCors } from '@/lib/embed/embedRouteGuard'
import { EMBED_DAILY_QUOTAS, EMBED_RATE_LIMITS } from '@/lib/embed/rateLimit'
import { saveChatUpload } from '@/lib/services/chatUpload'
import { getBusinessServices } from '@/lib/services/serviceConfig'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ roomName: string }> }

export async function OPTIONS(req: Request, routeContext: RouteContext) {
  const { roomName } = await routeContext.params
  return embedOptions(req, roomName)
}

/** Hosted business page chat: a document the chat asked for (multipart: `file`, `documentId`). */
export async function POST(req: Request, routeContext: RouteContext) {
  const { roomName } = await routeContext.params
  const guard = await guardEmbedRequest(req, roomName, {
    scope: 'chat',
    perSession: EMBED_RATE_LIMITS.mobile,
    perIp: EMBED_RATE_LIMITS.mobile,
    dailyQuota: EMBED_DAILY_QUOTAS.mobile,
  })
  if (!guard.ok) return guard.response

  const business = await getBusinessByRoomName(roomName)
  if (!business) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { chat } = await getBusinessServices(business.workspaceId)
  if (!chat.enabled) return jsonWithCors({ error: 'Chat is off', code: 'SERVICE_DISABLED' }, guard.corsHeaders, { status: 403 })

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  const documentId = form?.get('documentId')
  const result = await saveChatUpload({
    ownerUserId: business.userId,
    documentRequests: chat.config.documentRequests,
    file: file instanceof File ? file : null,
    documentId: typeof documentId === 'string' ? documentId : null,
  })
  if (!result.ok) return jsonWithCors({ error: result.error, code: result.code }, guard.corsHeaders, { status: result.status })
  return jsonWithCors({ ok: true, file: result.file, message: result.message }, guard.corsHeaders)
}
