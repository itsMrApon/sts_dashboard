import { EMBED_DAILY_QUOTAS, EMBED_RATE_LIMITS } from '@/lib/embed/rateLimit'
import { generateRoomChatReply } from '@/lib/services/chatReply'
import { getBusinessServices } from '@/lib/services/serviceConfig'
import { guardSdkRequest, sdkJson, sdkOptions, serviceDisabled } from '@/lib/sdk/sdkGuard'

export async function OPTIONS(request: Request) {
  return sdkOptions(request)
}

export async function POST(request: Request) {
  const guard = await guardSdkRequest(request, {
    scope: 'chat',
    perSession: EMBED_RATE_LIMITS.chat,
    perIp: EMBED_RATE_LIMITS.chatIp,
    dailyQuota: EMBED_DAILY_QUOTAS.chat,
  })
  if (!guard.ok) return guard.response

  const { chat } = await getBusinessServices(guard.business.workspaceId)
  if (!chat.enabled) return serviceDisabled(guard.corsHeaders, 'Chat AI')

  const body = (await request.json().catch(() => null)) as { message?: unknown } | null
  const message = typeof body?.message === 'string' ? body.message.trim() : ''
  if (!message) return sdkJson({ error: 'message is required', code: 'BAD_REQUEST' }, guard.corsHeaders, { status: 400 })
  if (message.length > chat.config.maxMessageLength) {
    return sdkJson(
      { error: `Message is longer than ${chat.config.maxMessageLength} characters.`, code: 'MESSAGE_TOO_LONG' },
      guard.corsHeaders,
      { status: 400 },
    )
  }

  try {
    // Conversation memory is keyed by the session, so a visitor keeps context until it expires.
    const result = await generateRoomChatReply({
      roomName: guard.business.roomName,
      message,
      sessionId: `sdk-${guard.claims.sid}`,
    })
    if (!result.ok) {
      return sdkJson({ error: result.error, code: result.code ?? 'CHAT_FAILED' }, guard.corsHeaders, { status: result.status })
    }
    return sdkJson(
      {
        reply: result.reply,
        links: chat.config.includeLinks
          ? { products: result.productLinks, buyNow: result.buyNowLink, social: result.socialAccounts }
          : null,
      },
      guard.corsHeaders,
    )
  } catch (error) {
    console.error('[sdk-chat]', error)
    return sdkJson({ error: 'Something went wrong', code: 'CHAT_FAILED' }, guard.corsHeaders, { status: 500 })
  }
}
